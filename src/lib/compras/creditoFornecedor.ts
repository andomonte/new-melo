/**
 * Crédito de fornecedor gerado no PAGAMENTO de título sem NF (roteiro, etapa 5 / fase 3).
 * docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md — decisões D4 e D6.
 *
 * Quando nasce: título de fornecedor PAGO (total ou parcial), sem NF, e
 *   - conta financeira 4 (ADIANTAMENTO A FORNECEDOR), ou
 *   - conta financeira 2 (FORNECEDOR LOCAL) em título AVULSO (fora do Compras).
 * Valor: o que foi pago (histórico dbfpgto não cancelado, sem a forma 45 ABATIMENTO DE SALDO;
 * sem histórico, dbpgto.valor_pago).
 * A NF associada CONSOME o crédito (credor_credito_uso.nfe_id). Pago DEPOIS de a NF estar no
 * título → não gera crédito (o pagamento é da nota).
 * Estorno do pagamento: baixa o crédito; se ele já foi usado, o estorno é BLOQUEADO
 * (CreditoUsadoError) até desfazer o uso.
 *
 * `sincronizarCreditoTitulo` é a rotina única, chamada por TODAS as formas de baixa e estorno.
 * Idempotente: recalcula o crédito pelo estado atual do título.
 */

/** Pool ou PoolClient (o que tiver .query). */
export interface Consultavel {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
}

export const ORIGEM_PAGAMENTO_SEM_NF = 'PAGAMENTO_SEM_NF';
const COF_LOCAL = 2;
const COF_ADIANTAMENTO = 4;
/** Formas que NÃO são dinheiro saindo (abatimento com crédito): não geram crédito novo.
 *  '45' = dbforma_pagto (migration 053); 'Z' = cad_forma_pgto (migration 091, a usada). */
const FORMAS_ABATIMENTO = ['45', 'Z'];
export const LETRA_ABATIMENTO = 'Z';
/** dbconta 0128 = CRÉDITO\ACERTO (não é caixa nem banco). */
export const CONTA_ABATIMENTO = '0128';

export class CreditoUsadoError extends Error {
  constructor(public usado: number, public codPgto: string) {
    super(
      `O crédito gerado pelo título ${codPgto} já foi usado (R$ ${usado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}). ` +
      'Desfaça o uso do crédito (tela Crédito de Fornecedor) antes de estornar ou alterar este título.',
    );
    this.name = 'CreditoUsadoError';
  }
}

const r2 = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

const statusPorSaldo = (disponivel: number, usado: number) =>
  disponivel <= 0.005 ? 'CONSUMIDO' : usado > 0.005 ? 'PARCIAL' : 'ABERTO';

/** Valor pago do título (histórico de pagamentos; sem histórico, valor_pago). */
export async function valorPagoDoTitulo(db: Consultavel, codPgto: string): Promise<number> {
  const r = await db.query(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbfpgto f WHERE f.cod_pgto = $1)
                 THEN (SELECT COALESCE(SUM(f.valor_pgto),0) FROM dbfpgto f
                        WHERE f.cod_pgto = $1 AND COALESCE(f.cancel,'N') <> 'S'
                          AND NOT (COALESCE(btrim(f.cod_fpgto),'') = ANY($2::text[])))
                 ELSE (SELECT COALESCE(valor_pago,0) FROM dbpgto WHERE cod_pgto = $1) END AS pago`,
    [codPgto, FORMAS_ABATIMENTO]);
  return r2(r.rows[0]?.pago);
}

/** Quanto do crédito já foi usado (usos não estornados). */
async function usadoDoCredito(db: Consultavel, creditoId: number | string): Promise<number> {
  const r = await db.query(
    `SELECT COALESCE(SUM(valor_usado),0) AS v FROM credor_credito_uso WHERE credito_id = $1 AND estornado_em IS NULL`,
    [creditoId]);
  return r2(r.rows[0]?.v);
}

export interface ResultadoCredito {
  creditoId: number | null;
  valor: number;
  disponivel: number;
  acao: 'NENHUMA' | 'CRIADO' | 'ATUALIZADO' | 'CANCELADO';
}

/**
 * Recalcula o crédito "pagamento sem NF" do título. Lança CreditoUsadoError se o crédito
 * precisaria cair abaixo do que já foi usado (estorno/edição bloqueados).
 */
export async function sincronizarCreditoTitulo(
  db: Consultavel, codPgto: string, usuario?: string | null,
): Promise<ResultadoCredito> {
  const t = (await db.query(
    `SELECT p.cod_pgto, p.cod_credor, p.tipo, p.pag_cof_id, COALESCE(p.cancel,'N') AS cancel, p.nro_dup,
            COALESCE(btrim(p.nro_nf),'') AS nro_nf, COALESCE(p.tem_nota,'N') AS tem_nota, COALESCE(p.obs,'') AS obs,
            EXISTS (SELECT 1 FROM ordem_pagamento_conta o WHERE o.cod_pgto = p.cod_pgto) AS do_compras,
            EXISTS (SELECT 1 FROM dbpgto_nota n WHERE n.cod_pgto = p.cod_pgto) AS tem_vinculo
       FROM dbpgto p WHERE p.cod_pgto = $1`, [codPgto])).rows[0];
  const nada: ResultadoCredito = { creditoId: null, valor: 0, disponivel: 0, acao: 'NENHUMA' };
  if (!t) return nada;

  const cof = Number(t.pag_cof_id);
  const avulso = !t.do_compras && !/^Pagamento ref\. NFe/i.test(t.obs);
  const contaGera = t.tipo === 'F' && (cof === COF_ADIANTAMENTO || (cof === COF_LOCAL && avulso));
  const semNF = !t.tem_vinculo && t.nro_nf === '' && t.tem_nota !== 'S';

  const cred = (await db.query(
    `SELECT id, valor_original, valor_disponivel, status FROM credor_credito
      WHERE cod_pgto = $1 AND origem = $2 FOR UPDATE`, [codPgto, ORIGEM_PAGAMENTO_SEM_NF])).rows[0];
  const pago = await valorPagoDoTitulo(db, codPgto);
  const usado = cred ? await usadoDoCredito(db, cred.id) : 0;
  const original = cred ? r2(cred.valor_original) : 0;
  const ativo = cred && cred.status !== 'CANCELADO';

  // Quanto o crédito deve valer agora:
  //  - cancelado / conta que não gera            → 0 (mantém só o que já foi usado)
  //  - sem NF                                    → o valor pago
  //  - NF pelo Compras (vínculo em dbpgto_nota)  → o crédito que existia (a NF o consome)
  //  - NF digitada no título                     → 0 (o pagamento era da nota — D4)
  let alvo: number;
  if (t.cancel === 'S' || !contaGera) alvo = ativo ? Math.min(original, pago) : 0;
  else if (semNF) alvo = pago;
  else if (t.tem_vinculo) alvo = ativo ? Math.min(original, pago) : 0;
  else alvo = 0;
  alvo = r2(alvo);

  if (alvo < usado - 0.005) throw new CreditoUsadoError(usado, codPgto);

  if (!cred) {
    if (alvo <= 0.005) return nada;
    const g = (await db.query(
      `SELECT COALESCE((SELECT grupo_key FROM credor_grupo WHERE cod_credor = c.cod_credor),
                       fn_grupo_credor(c.cpf_cgc), c.cod_credor) AS gk
         FROM dbcredor c WHERE c.cod_credor = $1`, [t.cod_credor])).rows[0];
    const obs = (cof === COF_ADIANTAMENTO ? 'Adiantamento pago sem NF' : 'Título avulso pago sem NF')
      + (t.nro_dup ? ` — ${t.nro_dup}` : '');
    const ins = await db.query(
      `INSERT INTO credor_credito
         (grupo_key, cod_credor, origem, cod_pgto, valor_original, valor_disponivel, status, obs, username)
       VALUES ($1,$2,$3,$4,$5,$5,'ABERTO',$6,$7) RETURNING id`,
      [g?.gk || t.cod_credor, t.cod_credor, ORIGEM_PAGAMENTO_SEM_NF, codPgto, alvo, obs,
       usuario ? String(usuario).slice(0, 60) : null]);
    return { creditoId: Number(ins.rows[0].id), valor: alvo, disponivel: alvo, acao: 'CRIADO' };
  }

  if (alvo <= 0.005) {
    if (!ativo) return { creditoId: Number(cred.id), valor: 0, disponivel: 0, acao: 'NENHUMA' };
    await db.query(
      `UPDATE credor_credito SET status = 'CANCELADO', valor_disponivel = 0, updatedat = now() WHERE id = $1`, [cred.id]);
    return { creditoId: Number(cred.id), valor: 0, disponivel: 0, acao: 'CANCELADO' };
  }

  const disponivel = r2(alvo - usado);
  const status = statusPorSaldo(disponivel, usado);
  if (ativo && Math.abs(original - alvo) < 0.005 && Math.abs(r2(cred.valor_disponivel) - disponivel) < 0.005
      && cred.status === status) {
    return { creditoId: Number(cred.id), valor: alvo, disponivel, acao: 'NENHUMA' };
  }
  await db.query(
    `UPDATE credor_credito SET valor_original = $2, valor_disponivel = $3, status = $4, updatedat = now() WHERE id = $1`,
    [cred.id, alvo, disponivel, status]);
  return { creditoId: Number(cred.id), valor: alvo, disponivel, acao: 'ATUALIZADO' };
}

/**
 * Versão para as rotas de BAIXA (pagar, marcar pago, retorno do banco): a baixa não pode
 * falhar por causa do crédito — o erro vai para o log e a rotina roda de novo no próximo
 * evento do título (ex.: ao configurar o pagamento da NF).
 */
export async function sincronizarCreditoAposBaixa(
  db: Consultavel, codPgto: string, usuario?: string | null, opts: { emTransacao?: boolean } = {},
) {
  // dentro de BEGIN…COMMIT, um erro de SQL abortaria a transação da baixa: isola num savepoint
  if (opts.emTransacao) await db.query('SAVEPOINT credito_fornecedor');
  try {
    const r = await sincronizarCreditoTitulo(db, codPgto, usuario);
    if (opts.emTransacao) await db.query('RELEASE SAVEPOINT credito_fornecedor');
    return r;
  } catch (e: any) {
    if (opts.emTransacao) await db.query('ROLLBACK TO SAVEPOINT credito_fornecedor').catch(() => undefined);
    console.error(`⚠️ Crédito do título ${codPgto} não sincronizado:`, e?.message || e);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Consumo pela NF (configurar pagamento da NFe)
// ---------------------------------------------------------------------------------------------

/** Reconfiguração da NF: devolve aos créditos o que esta NF tinha consumido. */
export async function desfazerConsumoDaNota(db: Consultavel, nfeId: string): Promise<void> {
  const r = await db.query(
    `DELETE FROM credor_credito_uso WHERE nfe_id = $1 AND estornado_em IS NULL RETURNING credito_id, valor_usado`,
    [nfeId]);
  for (const u of r.rows) {
    await db.query(
      `UPDATE credor_credito
          SET valor_disponivel = LEAST(valor_original, valor_disponivel + $2),
              status = CASE WHEN status = 'CANCELADO' THEN status
                            WHEN LEAST(valor_original, valor_disponivel + $2) >= valor_original - 0.005 THEN 'ABERTO'
                            ELSE 'PARCIAL' END,
              updatedat = now()
        WHERE id = $1`, [u.credito_id, u.valor_usado]);
  }
}

/** A NF consome `valor` do crédito. */
export async function consumirCreditoNaNota(
  db: Consultavel, creditoId: number, nfeId: string, nnf: string, valor: number, usuario?: string | null,
): Promise<void> {
  const v = r2(valor);
  if (v <= 0.005) return;
  await db.query(
    `INSERT INTO credor_credito_uso (credito_id, nfe_id, valor_usado, motivo, username)
     VALUES ($1,$2,$3,$4,$5)`,
    [creditoId, nfeId, v, `NF ${nnf}`, usuario ? String(usuario).slice(0, 60) : null]);
  await db.query(
    `UPDATE credor_credito
        SET valor_disponivel = GREATEST(0, valor_disponivel - $2),
            status = CASE WHEN valor_disponivel - $2 <= 0.005 THEN 'CONSUMIDO' ELSE 'PARCIAL' END,
            updatedat = now()
      WHERE id = $1`, [creditoId, v]);
}

export interface AdiantamentoDisponivel {
  cod_pgto: string;
  orc_id: number;
  nro_dup: string | null;
  valor_pgto: number;
  valor_pago: number;
  /** quanto ainda pode abater desta NF (crédito disponível + parte ainda não paga e não usada) */
  disponivel: number;
  creditoId: number | null;
  creditoDisponivel: number;
  data_vencimento: string | null;
  dt_pgto: string | null;
}

/**
 * Adiantamentos (parcela 0, não cancelados) das ordens e quanto cada um ainda pode abater
 * da NF `nfeId` — sem contar o que ESTA NF já usou (reconfiguração). Chame depois de
 * `desfazerConsumoDaNota` e de sincronizar o crédito dos pagos.
 */
export async function adiantamentosDisponiveis(
  db: Consultavel, orcIds: number[], nfeId: string,
): Promise<AdiantamentoDisponivel[]> {
  if (!orcIds.length) return [];
  const r = await db.query(
    `SELECT p.cod_pgto, opc.orc_id, p.nro_dup, COALESCE(p.valor_pgto,0) AS valor_pgto,
            opc.data_vencimento::text AS data_vencimento, p.dt_pgto::text AS dt_pgto,
            COALESCE(p.valor_pago,0) AS valor_pago,
            k.id AS credito_id,
            -- disponível + o que ESTA NF já consumiu (consulta antes de desfazer, na tela)
            COALESCE(k.valor_disponivel,0) + COALESCE((SELECT SUM(u.valor_usado) FROM credor_credito_uso u
                       WHERE u.credito_id = k.id AND u.estornado_em IS NULL AND u.nfe_id = $2), 0) AS credito_disponivel,
            COALESCE(k.valor_original,0) AS credito_original,
            COALESCE((SELECT SUM(n.valor_atendido) FROM dbpgto_nota n
                       WHERE n.cod_pgto = p.cod_pgto AND n.codnfe_ent <> $2), 0) AS atendido_outras,
            COALESCE((SELECT SUM(u.valor_usado) FROM credor_credito_uso u
                       WHERE u.credito_id = k.id AND u.estornado_em IS NULL AND u.nfe_id IS DISTINCT FROM $2), 0) AS credito_usado_outras
       FROM dbpgto p
       JOIN ordem_pagamento_conta opc ON opc.cod_pgto = p.cod_pgto AND opc.numero_parcela = 0
       LEFT JOIN credor_credito k ON k.cod_pgto = p.cod_pgto AND k.origem = $3 AND k.status <> 'CANCELADO'
      WHERE opc.orc_id = ANY($1::bigint[]) AND COALESCE(p.cancel,'N') <> 'S'
      ORDER BY (k.id IS NULL), p.cod_pgto`,
    [orcIds, nfeId, ORIGEM_PAGAMENTO_SEM_NF]);
  const vistos = new Set<string>();
  const out: AdiantamentoDisponivel[] = [];
  for (const x of r.rows) {
    if (vistos.has(x.cod_pgto)) continue;
    vistos.add(x.cod_pgto);
    const valor = r2(x.valor_pgto);
    let disponivel: number;
    if (x.credito_id) {
      // parte paga = crédito; parte ainda em aberto do título, descontado o que outras notas
      // usaram além do crédito
      const abertoUsadoOutras = Math.max(0, r2(x.atendido_outras) - r2(x.credito_usado_outras));
      const aberto = Math.max(0, valor - r2(x.credito_original) - abertoUsadoOutras);
      disponivel = r2(Number(x.credito_disponivel) + aberto);
    } else {
      disponivel = Math.max(0, r2(valor - Number(x.atendido_outras)));
    }
    out.push({
      cod_pgto: x.cod_pgto, orc_id: Number(x.orc_id), nro_dup: x.nro_dup ?? null,
      valor_pgto: valor, valor_pago: r2(x.valor_pago), disponivel,
      creditoId: x.credito_id ? Number(x.credito_id) : null, creditoDisponivel: r2(x.credito_disponivel),
      data_vencimento: x.data_vencimento ?? null, dt_pgto: x.dt_pgto ?? null,
    });
  }
  return out;
}

export interface AdiantamentoEmAberto extends AdiantamentoDisponivel {
  /** quanto do título ainda não foi pago */
  em_aberto: number;
}

/**
 * Adiantamentos (parcela 0 da ordem) que entram nesta NF e ainda NÃO foram pagos (no todo ou em
 * parte). Regra de 25/11/2026: com adiantamento em aberto a cobrança da NF NÃO é gerada — o
 * comprador pede ao Financeiro o pagamento do título e depois conclui. (Antes, o não pago que
 * cobria a NF era cancelado e a cobrança saía pela NF inteira.)
 */
export function adiantamentosEmAberto(lista: AdiantamentoDisponivel[]): AdiantamentoEmAberto[] {
  return lista
    .filter((a) => a.disponivel > 0.005 && r2(a.valor_pgto - a.valor_pago) > 0.005)
    .map((a) => ({ ...a, em_aberto: r2(a.valor_pgto - a.valor_pago) }));
}

/** Mensagem para a tela/erro quando há adiantamento em aberto. */
export function mensagemAdiantamentoEmAberto(lista: AdiantamentoEmAberto[]): string {
  const dataBR = (s: string | null) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '-';
  };
  const itens = lista.map((a) =>
    `título ${a.nro_dup || a.cod_pgto} da ordem ${a.orc_id} (R$ ${a.em_aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em aberto, venc. ${dataBR(a.data_vencimento)})`);
  return `A cobrança desta NF não pode ser gerada: há pagamento antecipado ainda não pago — ${itens.join('; ')}. `
    + 'Solicite ao Financeiro o pagamento do adiantamento e depois conclua a geração da cobrança.';
}

// ---------------------------------------------------------------------------------------------
// Tela Crédito de Fornecedor (fase 4): lista, detalhe, títulos em aberto, usar e estornar uso.
// O grupo é o fornecedor + filiais (raiz do CNPJ; override em credor_grupo).
// ---------------------------------------------------------------------------------------------

/** Expressão SQL do grupo de um dbcredor `c`. */
export const SQL_GRUPO_CREDOR =
  `COALESCE((SELECT g.grupo_key FROM credor_grupo g WHERE g.cod_credor = c.cod_credor), fn_grupo_credor(c.cpf_cgc), c.cod_credor)`;

const hojeISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Manaus' }); // yyyy-mm-dd
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function tabelaExiste(db: Consultavel, nome: string) {
  const r = await db.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [nome]);
  return !!r.rows[0]?.ok;
}

/** Fornecedores (grupos) com crédito. `todos` inclui os já zerados. */
export async function listarGruposComCredito(db: Consultavel, opts: { q?: string; todos?: boolean } = {}) {
  const q = String(opts.q || '').trim();
  const r = await db.query(
    `WITH k AS (
       SELECT grupo_key,
              COUNT(*) FILTER (WHERE status IN ('ABERTO','PARCIAL') AND valor_disponivel > 0) AS qtd_abertos,
              COALESCE(SUM(valor_disponivel) FILTER (WHERE status IN ('ABERTO','PARCIAL')), 0) AS saldo,
              COALESCE(SUM(valor_original) FILTER (WHERE status <> 'CANCELADO'), 0) AS total_gerado,
              MIN(dt_credito) FILTER (WHERE status IN ('ABERTO','PARCIAL') AND valor_disponivel > 0) AS mais_antigo,
              (ARRAY_AGG(cod_credor ORDER BY dt_credito))[1] AS cod_credor_ref
         FROM credor_credito GROUP BY grupo_key
     ), credores AS (
       SELECT c.cod_credor, c.nome, c.cpf_cgc, ${SQL_GRUPO_CREDOR} AS grupo_key
         FROM dbcredor c
        WHERE ${SQL_GRUPO_CREDOR} IN (SELECT grupo_key FROM k)
     )
     SELECT k.grupo_key, k.qtd_abertos::int AS qtd_abertos, k.saldo, k.total_gerado,
            k.mais_antigo::text AS mais_antigo,
            (current_date - k.mais_antigo::date) AS dias_mais_antigo,
            ref.nome, ref.cpf_cgc,
            (SELECT COUNT(*) FROM credores x WHERE x.grupo_key = k.grupo_key)::int AS qtd_filiais,
            (SELECT COUNT(*) FROM dbpgto p JOIN credores x ON x.cod_credor = p.cod_credor AND x.grupo_key = k.grupo_key
              WHERE p.tipo = 'F' AND COALESCE(p.cancel,'N') <> 'S' AND COALESCE(p.paga,'N') <> 'S'
                AND COALESCE(p.pag_cof_id,0) <> 4)::int AS qtd_titulos_abertos
       FROM k LEFT JOIN dbcredor ref ON ref.cod_credor = k.cod_credor_ref
      WHERE ($1::boolean OR k.saldo > 0.005)
        AND ($2 = '' OR ref.nome ILIKE '%' || $2 || '%'
             OR EXISTS (SELECT 1 FROM credores x WHERE x.grupo_key = k.grupo_key
                         AND (x.nome ILIKE '%' || $2 || '%'
                              OR (regexp_replace($2, '[^0-9]', '', 'g') <> ''
                                  AND regexp_replace(COALESCE(x.cpf_cgc,''), '[^0-9]', '', 'g')
                                      LIKE '%' || regexp_replace($2, '[^0-9]', '', 'g') || '%'))))
      ORDER BY k.saldo DESC, ref.nome`,
    [!!opts.todos, q]);
  return r.rows.map((x: any) => ({ ...x, saldo: r2(x.saldo), total_gerado: r2(x.total_gerado) }));
}

/** Detalhe do grupo: filiais, créditos e histórico (pagamentos que geraram, notas e títulos que consumiram, estornos). */
export async function detalheGrupo(db: Consultavel, grupo: string) {
  const credores = (await db.query(
    `SELECT c.cod_credor, c.nome, c.cpf_cgc FROM dbcredor c WHERE ${SQL_GRUPO_CREDOR} = $1 ORDER BY c.nome`, [grupo])).rows;
  const creditos = (await db.query(
    `SELECT k.id, k.cod_credor, cr.nome, k.origem, k.cod_pgto, k.nfe_id, k.valor_original, k.valor_disponivel,
            k.status, k.dt_credito::text AS dt_credito, k.obs, k.username,
            p.nro_dup, p.pag_cof_id, cf.cof_descricao AS conta_financeira, p.dt_pgto::text AS dt_pgto, p.valor_pgto,
            (SELECT o.orc_id::text FROM ordem_pagamento_conta o WHERE o.cod_pgto = k.cod_pgto LIMIT 1) AS orc_id,
            COALESCE((SELECT SUM(u.valor_usado) FROM credor_credito_uso u WHERE u.credito_id = k.id AND u.estornado_em IS NULL),0) AS usado
       FROM credor_credito k
       LEFT JOIN dbcredor cr ON cr.cod_credor = k.cod_credor
       LEFT JOIN dbpgto p ON p.cod_pgto = k.cod_pgto
       LEFT JOIN cad_conta_financeira cf ON cf.cof_id = p.pag_cof_id
      WHERE k.grupo_key = $1
      ORDER BY k.dt_credito, k.id`, [grupo])).rows;
  const usos = (await db.query(
    `SELECT u.id, u.credito_id, u.valor_usado, u.dt_uso::text AS dt_uso, u.motivo, u.username, u.fpg_cof_id,
            u.nfe_id, n.nnf::text AS nnf, n.vnf AS valor_nf,
            u.cod_pgto_abatido, u.cod_credor_abatido, pa.nro_dup AS dup_abatido, pa.nro_nf AS nf_abatido,
            pa.valor_pgto AS valor_titulo_abatido, cra.nome AS nome_abatido,
            u.estornado_em::text AS estornado_em, u.estornado_por, u.motivo_estorno,
            k.cod_pgto AS cod_pgto_origem, po.nro_dup AS dup_origem
       FROM credor_credito_uso u
       JOIN credor_credito k ON k.id = u.credito_id
       LEFT JOIN dbnfe_ent n ON n.codnfe_ent = u.nfe_id
       LEFT JOIN dbpgto pa ON pa.cod_pgto = u.cod_pgto_abatido
       LEFT JOIN dbcredor cra ON cra.cod_credor = u.cod_credor_abatido
       LEFT JOIN dbpgto po ON po.cod_pgto = k.cod_pgto
      WHERE k.grupo_key = $1
      ORDER BY u.dt_uso DESC, u.id DESC`, [grupo])).rows;
  const num = (o: any, ...ks: string[]) => { for (const k of ks) if (o[k] != null) o[k] = r2(o[k]); return o; };
  return {
    grupo,
    credores,
    creditos: creditos.map((c: any) => num(c, 'valor_original', 'valor_disponivel', 'valor_pgto', 'usado')),
    usos: usos.map((u: any) => num(u, 'valor_usado', 'valor_nf', 'valor_titulo_abatido')),
    saldo: r2(creditos.filter((c: any) => ['ABERTO', 'PARCIAL'].includes(c.status))
      .reduce((s2: number, c: any) => s2 + Number(c.valor_disponivel), 0)),
  };
}

/** Títulos em aberto do fornecedor e das filiais (para "Usar crédito"). Adiantamentos (conta 4) ficam fora. */
export async function titulosAbertosDoGrupo(db: Consultavel, grupo: string) {
  const temSispag = await tabelaExiste(db, 'dbpgto_sispag');
  const temArq = await tabelaExiste(db, 'pgt_arquivo_sispag');
  const r = await db.query(
    `SELECT p.cod_pgto, p.cod_credor, c.nome, p.nro_nf, p.nro_dup, p.dt_venc::text AS dt_venc,
            p.dt_emissao::text AS dt_emissao, COALESCE(p.valor_pgto,0) AS valor_pgto, p.pag_cof_id,
            cf.cof_descricao AS conta_financeira, x.pago,
            GREATEST(0, COALESCE(p.valor_pgto,0) - x.pago) AS saldo,
            (${temSispag ? 'EXISTS (SELECT 1 FROM dbpgto_sispag sp WHERE sp.spg_cod_pgto = p.cod_pgto)' : 'false'}
             OR ${temArq ? 'EXISTS (SELECT 1 FROM pgt_arquivo_sispag aq WHERE aq.aqs_cod_pgto = p.cod_pgto)' : 'false'}) AS em_remessa
       FROM dbpgto p
       JOIN dbcredor c ON c.cod_credor = p.cod_credor
       LEFT JOIN cad_conta_financeira cf ON cf.cof_id = p.pag_cof_id
       CROSS JOIN LATERAL (
         SELECT CASE WHEN EXISTS (SELECT 1 FROM dbfpgto f WHERE f.cod_pgto = p.cod_pgto)
                     THEN (SELECT COALESCE(SUM(f.valor_pgto),0) FROM dbfpgto f
                            WHERE f.cod_pgto = p.cod_pgto AND COALESCE(f.cancel,'N') <> 'S')
                     ELSE COALESCE(p.valor_pago,0) END AS pago) x
      WHERE ${SQL_GRUPO_CREDOR} = $1
        AND p.tipo = 'F' AND COALESCE(p.cancel,'N') <> 'S' AND COALESCE(p.paga,'N') <> 'S'
        AND COALESCE(p.pag_cof_id,0) <> 4
        AND COALESCE(p.valor_pgto,0) - x.pago > 0.005
      ORDER BY p.dt_venc NULLS LAST, p.cod_pgto`, [grupo]);
  return r.rows.map((t: any) => ({ ...t, valor_pgto: r2(t.valor_pgto), pago: r2(t.pago), saldo: r2(t.saldo) }));
}

export class CreditoValidacaoError extends Error {
  constructor(msg: string) { super(msg); this.name = 'CreditoValidacaoError'; }
}

/** Pago atual do título (todos os lançamentos não cancelados, inclusive abatimento). */
async function pagoTotalDoTitulo(db: Consultavel, codPgto: string) {
  const r = await db.query(
    `SELECT CASE WHEN EXISTS (SELECT 1 FROM dbfpgto f WHERE f.cod_pgto = $1)
                 THEN (SELECT COALESCE(SUM(f.valor_pgto),0) FROM dbfpgto f WHERE f.cod_pgto = $1 AND COALESCE(f.cancel,'N') <> 'S')
                 ELSE (SELECT COALESCE(valor_pago,0) FROM dbpgto WHERE cod_pgto = $1) END AS pago`, [codPgto]);
  return r2(r.rows[0]?.pago);
}

/** Refaz valor_pago / paga do título pelo histórico. */
async function atualizarPagoDoTitulo(db: Consultavel, codPgto: string, dtPgto?: string | null) {
  const pago = await pagoTotalDoTitulo(db, codPgto);
  await db.query(
    `UPDATE dbpgto SET valor_pago = $2,
            paga = CASE WHEN $2 >= COALESCE(valor_pgto,0) - 0.01 THEN 'S' ELSE 'N' END,
            dt_pgto = COALESCE($3::date, dt_pgto)
      WHERE cod_pgto = $1`, [codPgto, pago, dtPgto || null]);
  return pago;
}

export interface ItemUsoCredito { cod_pgto: string; valor: number }

/**
 * Baixa títulos do fornecedor/filiais com o crédito do grupo (forma Z ABATIMENTO DE SALDO,
 * conta 0128). Consome os créditos mais antigos primeiro. Usar dentro de BEGIN…COMMIT.
 */
export async function usarCredito(
  db: Consultavel, grupo: string, itens: ItemUsoCredito[], usuario: string, obs?: string | null,
) {
  const lista = itens
    .map((i) => ({ cod_pgto: String(i.cod_pgto || '').trim(), valor: r2(i.valor) }))
    .filter((i) => i.cod_pgto && i.valor > 0.005);
  if (!lista.length) throw new CreditoValidacaoError('Selecione ao menos um título e o valor a abater.');
  if (new Set(lista.map((i) => i.cod_pgto)).size !== lista.length) throw new CreditoValidacaoError('Título repetido na seleção.');

  await db.query(`SELECT pg_advisory_xact_lock(hashtext('credor_credito:' || $1))`, [grupo]);
  const creditos = (await db.query(
    `SELECT id, valor_disponivel FROM credor_credito
      WHERE grupo_key = $1 AND status IN ('ABERTO','PARCIAL') AND valor_disponivel > 0
      ORDER BY dt_credito, id FOR UPDATE`, [grupo])).rows.map((c: any) => ({ id: Number(c.id), disp: r2(c.valor_disponivel) }));
  const saldo = r2(creditos.reduce((s2, c) => s2 + c.disp, 0));
  const total = r2(lista.reduce((s2, i) => s2 + i.valor, 0));
  if (total > saldo + 0.005) {
    throw new CreditoValidacaoError(`O total a abater (R$ ${brl(total)}) passa do crédito disponível (R$ ${brl(saldo)}).`);
  }

  const abertos = new Map((await titulosAbertosDoGrupo(db, grupo)).map((t) => [t.cod_pgto, t]));
  for (const i of lista) {
    const t = abertos.get(i.cod_pgto);
    if (!t) throw new CreditoValidacaoError(`O título ${i.cod_pgto} não está em aberto para este fornecedor/filiais.`);
    if (t.em_remessa) throw new CreditoValidacaoError(`O título ${t.nro_dup || i.cod_pgto} está em remessa de pagamento no banco (SISPAG).`);
    if (i.valor > t.saldo + 0.01) {
      throw new CreditoValidacaoError(`O valor para o título ${t.nro_dup || i.cod_pgto} (R$ ${brl(i.valor)}) passa do saldo dele (R$ ${brl(t.saldo)}).`);
    }
  }

  const hoje = hojeISO();
  const user = String(usuario || 'Sistema').slice(0, 60);
  const baixas: { cod_pgto: string; valor: number; fpg_cof_id: number }[] = [];
  let ci = 0;
  for (const i of lista) {
    const t = abertos.get(i.cod_pgto)!;
    // lançamento no histórico de pagamentos do título
    await db.query(`SELECT pg_advisory_xact_lock(hashtext('dbfpgto.fpg_cof_id'))`);
    const fpg = Number((await db.query(`SELECT COALESCE(MAX(fpg_cof_id),0) + 1 AS n FROM dbfpgto`)).rows[0].n);
    await db.query(
      `INSERT INTO dbfpgto (cod_pgto, cod_fpgto, fpg_cof_id, dt_pgto, valor_pgto, tp_pgto, cancel,
                            desconto, multa, juros, cod_conta, dt_venc, dt_emissao, sf, import, username)
       VALUES ($1,$2,$3,$4,$5,$2,'N',0,0,0,$6,$7,$8,'N','N',$9)`,
      [i.cod_pgto, LETRA_ABATIMENTO, fpg, hoje, i.valor, CONTA_ABATIMENTO, t.dt_venc || null, t.dt_emissao || null, user]);
    await atualizarPagoDoTitulo(db, i.cod_pgto, hoje);
    await db.query(
      `UPDATE dbpgto SET obs = left(COALESCE(obs,'') || $2, 500) WHERE cod_pgto = $1`,
      [i.cod_pgto, ` | Abatido com crédito de fornecedor: R$ ${brl(i.valor)} em ${hoje.split('-').reverse().join('/')}`]);

    // consome os créditos, do mais antigo para o mais novo
    let falta = i.valor;
    while (falta > 0.005 && ci < creditos.length) {
      const c = creditos[ci];
      const parte = r2(Math.min(c.disp, falta));
      if (parte > 0.005) {
        await db.query(
          `INSERT INTO credor_credito_uso (credito_id, cod_pgto_abatido, cod_credor_abatido, valor_usado, motivo, username, fpg_cof_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [c.id, i.cod_pgto, t.cod_credor, parte, obs ? String(obs).slice(0, 250) : `Abatimento do título ${t.nro_dup || i.cod_pgto}`, user, fpg]);
        c.disp = r2(c.disp - parte);
        await db.query(
          `UPDATE credor_credito SET valor_disponivel = $2,
                  status = CASE WHEN $2 <= 0.005 THEN 'CONSUMIDO' ELSE 'PARCIAL' END, updatedat = now()
            WHERE id = $1`, [c.id, c.disp]);
        falta = r2(falta - parte);
      }
      if (c.disp <= 0.005) ci++;
    }
    baixas.push({ cod_pgto: i.cod_pgto, valor: i.valor, fpg_cof_id: fpg });
  }
  return { total, saldo_restante: r2(saldo - total), baixas };
}

/** Devolve ao crédito os usos de um lançamento (baixa com crédito) e marca o estorno. */
export async function devolverUsosDoLancamento(
  db: Consultavel, codPgto: string, fpgCofId: number | string, motivo: string, usuario: string,
): Promise<number> {
  const usos = (await db.query(
    `UPDATE credor_credito_uso SET estornado_em = now(), estornado_por = $3, motivo_estorno = $4
      WHERE cod_pgto_abatido = $1 AND fpg_cof_id = $2 AND estornado_em IS NULL
      RETURNING credito_id, valor_usado`,
    [codPgto, fpgCofId, String(usuario || 'Sistema').slice(0, 60), String(motivo || '').slice(0, 250)])).rows;
  let total = 0;
  for (const u of usos) {
    await db.query(
      `UPDATE credor_credito
          SET valor_disponivel = LEAST(valor_original, valor_disponivel + $2),
              status = CASE WHEN status = 'CANCELADO' THEN status
                            WHEN LEAST(valor_original, valor_disponivel + $2) >= valor_original - 0.005 THEN 'ABERTO'
                            ELSE 'PARCIAL' END,
              updatedat = now()
        WHERE id = $1`, [u.credito_id, u.valor_usado]);
    total += Number(u.valor_usado);
  }
  return r2(total);
}

/** Estorno de uma baixa com crédito (tela): cancela o lançamento, devolve o crédito e refaz o pago. */
export async function estornarBaixaComCredito(
  db: Consultavel, codPgto: string, fpgCofId: number | string, motivo: string, usuario: string,
) {
  if (!String(motivo || '').trim()) throw new CreditoValidacaoError('Informe o motivo do estorno.');
  const f = (await db.query(
    `SELECT cod_fpgto, COALESCE(cancel,'N') AS cancel FROM dbfpgto WHERE cod_pgto = $1 AND fpg_cof_id = $2 FOR UPDATE`,
    [codPgto, fpgCofId])).rows[0];
  if (!f) throw new CreditoValidacaoError('Lançamento da baixa não encontrado.');
  if (String(f.cod_fpgto).trim() !== LETRA_ABATIMENTO) throw new CreditoValidacaoError('Este lançamento não é uma baixa com crédito.');
  const devolvido = await devolverUsosDoLancamento(db, codPgto, fpgCofId, motivo, usuario);
  if (devolvido <= 0.005) throw new CreditoValidacaoError('Este uso de crédito já foi estornado.');
  if (f.cancel !== 'S') {
    await db.query(`UPDATE dbfpgto SET cancel = 'S' WHERE cod_pgto = $1 AND fpg_cof_id = $2`, [codPgto, fpgCofId]);
  }
  const pago = await atualizarPagoDoTitulo(db, codPgto);
  await db.query(
    `UPDATE dbpgto SET obs = left(COALESCE(obs,'') || $2, 500) WHERE cod_pgto = $1`,
    [codPgto, ` | Estorno de abatimento com crédito: R$ ${brl(devolvido)} (${String(motivo).slice(0, 80)})`]);
  return { devolvido, pago_atual: pago };
}

/** Códigos de credor que têm crédito disponível no grupo (selo no Contas a Pagar). */
export async function credoresComCredito(db: Consultavel): Promise<string[]> {
  const r = await db.query(
    `SELECT c.cod_credor FROM dbcredor c
      WHERE ${SQL_GRUPO_CREDOR} IN (SELECT grupo_key FROM credor_credito
                                     WHERE status IN ('ABERTO','PARCIAL') AND valor_disponivel > 0.005)`);
  return r.rows.map((x: any) => String(x.cod_credor));
}

/** Grupo (fornecedor + filiais) de um credor. */
export async function grupoDoCredor(db: Consultavel, codCredor: string): Promise<string | null> {
  const r = await db.query(`SELECT ${SQL_GRUPO_CREDOR} AS g FROM dbcredor c WHERE c.cod_credor = $1`, [codCredor]);
  return r.rows[0]?.g ?? null;
}
