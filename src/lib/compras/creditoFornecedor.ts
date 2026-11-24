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
const FORMA_ABATIMENTO = '45';

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
                          AND COALESCE(btrim(f.cod_fpgto),'') <> $2)
                 ELSE (SELECT COALESCE(valor_pago,0) FROM dbpgto WHERE cod_pgto = $1) END AS pago`,
    [codPgto, FORMA_ABATIMENTO]);
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
