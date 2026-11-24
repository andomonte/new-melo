/**
 * Regras dos títulos a pagar (dbpgto) gerados pelo Compras: pagamento da ordem de compra
 * (antecipado e parcelas) e parcelas do restante da NFe.
 * Roteiro aprovado: docs/saldo-fornecedor/roteiro-adiantamento-nfe-credito.md (24/11/2026)
 *
 *  - Conta financeira (dbpgto.pag_cof_id → cad_conta_financeira):
 *      adiantamento (parcela 0 da OC)  → 4  ADIANTAMENTO A FORNECEDOR
 *      demais (D1)                     → 1  FORNECEDOR INTERNACIONAL  (importação / exterior)
 *                                        3  FORNECEDOR FORA DO ESTADO (UF ≠ UF da filial)
 *                                        2  FORNECEDOR LOCAL           (demais)
 *    Antes era MAX(pag_cof_id)+1 — caía em conta errada/inexistente.
 *  - Código do título (cod_pgto): MAX+1 com trava (pg_advisory_xact_lock), para dois
 *    usuários ao mesmo tempo não gerarem o mesmo código/duplicata.
 *  - Duplicata da OC: OC{nº da ordem}/{parcela}/{total}  (ex.: OC12026110045/1/1).
 *  - Banco: código de dbbanco (a tela manda o nome, ex. "MELO COMERCIO" → 0062).
 * Só servidor; usar dentro de uma transação (BEGIN … COMMIT).
 */
import type { PoolClient } from 'pg';

export const COF_INTERNACIONAL = 1;
export const COF_LOCAL = 2;
export const COF_FORA_ESTADO = 3;
export const COF_ADIANTAMENTO = 4;
/** Títulos de frete (CT-e / notas de conhecimento). */
export const COF_FRETE_NACIONAL = 7;

const UF_FILIAL: Record<string, string> = { MANAUS: 'AM', RORAIMA: 'RR', BOAVISTA: 'RR', RONDONIA: 'RO' };

/** UF da filial MELO (cookie filial_melo, ex. "MANAUS"). Padrão: AM. */
export const ufDaFilial = (filial?: string | null) =>
  UF_FILIAL[String(filial || '').trim().toUpperCase().replace(/\s+/g, '')] || 'AM';

/** Conta financeira do título de fornecedor (regra D1). */
export async function contaFinanceiraFornecedor(
  client: PoolClient,
  codCredor: string,
  opts: { ufFilial: string; importacao?: boolean },
): Promise<number> {
  if (opts.importacao) return COF_INTERNACIONAL;
  const r = await client.query(
    `SELECT upper(btrim(COALESCE(uf::text,''))) AS uf, btrim(COALESCE(codpais::text,'')) AS codpais,
            upper(COALESCE(tipo::text,'')) AS tipo
       FROM dbcredor WHERE cod_credor = $1 LIMIT 1`,
    [codCredor],
  );
  const c = r.rows[0];
  if (!c) return COF_LOCAL;
  if (c.uf === 'EX' || c.tipo === 'X' || (c.codpais && c.codpais !== '1058')) return COF_INTERNACIONAL;
  if (/^[A-Z]{2}$/.test(c.uf) && c.uf !== opts.ufFilial) return COF_FORA_ESTADO;
  return COF_LOCAL;
}

/**
 * Próximo cod_pgto (9 dígitos). Trava até o fim da transação: quem chega depois espera e
 * já enxerga o título gravado por quem chegou antes.
 */
export async function proximoCodPgto(client: PoolClient): Promise<string> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('dbpgto.cod_pgto'))`);
  const r = await client.query(
    `SELECT COALESCE(MAX(CAST(cod_pgto AS BIGINT)), 0) + 1 AS prox FROM dbpgto WHERE cod_pgto ~ '^[0-9]+$'`,
  );
  return String(r.rows[0].prox).padStart(9, '0');
}

/** Duplicata do título da ordem de compra: OC{orc}/{parcela}/{total} (campo de 20). */
export const duplicataOrdem = (orcId: number | string, parcela: number, total: number) =>
  `OC${orcId}/${parcela}/${total}`.slice(0, 20);

/**
 * Duplicata do título do restante da NF (decisão D2): {duplicata do XML}/{parcela}/{total}.
 * Duplicata do XML que é só a sequência ("001", "2") ou vazia → nº da NF no lugar.
 * O que vem depois da 1ª "/" é descartado (a tela manda "001/3" nas parcelas manuais).
 * Ex.: NF 78239, XML "001"/"002" → "78239/1/2", "78239/2/2"; XML "78239-A" → "78239-A/1/1".
 */
export function duplicataNota(dupXml: string | null | undefined, numeroNF: string, parcela: number, total: number) {
  const bruto = String(dupXml || '').split('/')[0].trim().replace(/\s+/g, '');
  const base = !bruto || /^\d{1,3}$/.test(bruto) ? String(numeroNF || '').trim() : bruto;
  const sufixo = `/${parcela}/${total}`;
  return `${base.slice(0, 20 - sufixo.length)}${sufixo}`;
}

/** Código do banco (dbbanco.cod_banco) a partir do nome ou código vindo da tela. */
export async function codigoBanco(client: PoolClient, banco?: string | null): Promise<string | null> {
  const b = String(banco || '').trim();
  if (!b) return null;
  if (/^\d{1,4}$/.test(b)) return b.padStart(4, '0');
  // nome exato; senão, começo do nome com um único banco ("MELO COM" → "MELO COMERCIO")
  const r = await client.query(
    `SELECT cod_banco, upper(btrim(nome)) = upper($1) AS exato
       FROM dbbanco WHERE upper(btrim(nome)) LIKE upper($1) || '%'
      ORDER BY 2 DESC, cod_banco LIMIT 2`,
    [b],
  );
  if (r.rows[0]?.exato || r.rows.length === 1) return r.rows[0].cod_banco;
  return b; // sem cadastro (ou ambíguo): mantém o que veio, não perde a informação
}

// ---------------------------------------------------------------------------------------------
// Notas do título (dbpgto_nota, migration 089) — roteiro, etapas 3 e 4.
// Cada NF que um título atendeu: o ADIANTAMENTO (parcela 0 da ordem; pode atender várias notas)
// e as PARCELAS geradas pela NF. dbpgto.nro_nf guarda os números juntos por "/" (até 200).
// ---------------------------------------------------------------------------------------------

export interface NotaDoTitulo {
  codnfe_ent: string;
  nnf: string;
  serie?: string | null;
  chave?: string | null;
  valor_nf: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hojeBR = () => new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Manaus' });

/** Dados da NF para o vínculo (número real, série, chave, valor). */
export async function dadosNota(client: PoolClient, codnfeEnt: string): Promise<NotaDoTitulo> {
  const r = await client.query(
    `SELECT codnfe_ent, nnf::text AS nnf, serie::text AS serie, chave, COALESCE(vnf,0) AS vnf
       FROM dbnfe_ent WHERE codnfe_ent = $1`, [codnfeEnt]);
  const n = r.rows[0];
  return {
    codnfe_ent: codnfeEnt,
    nnf: String(n?.nnf || '').trim() || String(codnfeEnt).replace(/^0+/, ''),
    serie: n?.serie ?? null,
    chave: n?.chave ?? null,
    valor_nf: Number(n?.vnf || 0),
  };
}

/** Grava (ou atualiza) o vínculo título ↔ nota. Devolve true se o vínculo é NOVO. */
export async function vincularNotaTitulo(
  client: PoolClient, codPgto: string, nota: NotaDoTitulo,
  tipo: 'ADIANTAMENTO' | 'PARCELA', valorAtendido: number, usuario?: string | null,
): Promise<boolean> {
  const r = await client.query(
    `INSERT INTO dbpgto_nota (cod_pgto, codnfe_ent, nnf, serie, chave, tipo, valor_nf, valor_atendido, usuario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (cod_pgto, codnfe_ent) DO UPDATE
       SET valor_atendido = EXCLUDED.valor_atendido, valor_nf = EXCLUDED.valor_nf, usuario = EXCLUDED.usuario
     RETURNING (xmax = 0) AS novo`,
    [codPgto, nota.codnfe_ent, nota.nnf, nota.serie ?? null, nota.chave ?? null, tipo,
     nota.valor_nf, Math.round(valorAtendido * 100) / 100, usuario ? String(usuario).slice(0, 60) : null]);
  return !!r.rows[0]?.novo;
}

/** Quanto do título já foi usado em OUTRAS notas (para o adiantamento não cobrir duas vezes). */
export async function atendidoEmOutrasNotas(client: PoolClient, codPgto: string, codnfeEnt: string): Promise<number> {
  const r = await client.query(
    `SELECT COALESCE(SUM(valor_atendido),0) AS v FROM dbpgto_nota WHERE cod_pgto = $1 AND codnfe_ent <> $2`,
    [codPgto, codnfeEnt]);
  return Number(r.rows[0]?.v || 0);
}

/** Refaz dbpgto.nro_nf (números por "/") e tem_nota a partir dos vínculos do título. */
export async function atualizarNfDoTitulo(client: PoolClient, codPgto: string): Promise<void> {
  await client.query(
    `UPDATE dbpgto p SET nro_nf = x.notas, tem_nota = 'S'
       FROM (SELECT left(string_agg(nnf, '/' ORDER BY criado_em, id), 200) AS notas
               FROM dbpgto_nota WHERE cod_pgto = $1) x
      WHERE p.cod_pgto = $1 AND x.notas IS NOT NULL`, [codPgto]);
}

/**
 * Associa a NF ao título de ADIANTAMENTO: vínculo, campo NF ("78239/78301") e, se o vínculo
 * é novo, a observação "NF 78239 associada em 24/11/2026: R$ 1.000,00 atendido".
 */
export async function associarNotaAoAdiantamento(
  client: PoolClient, codPgto: string, nota: NotaDoTitulo, valorAtendido: number, usuario?: string | null,
): Promise<void> {
  const novo = await vincularNotaTitulo(client, codPgto, nota, 'ADIANTAMENTO', valorAtendido, usuario);
  await atualizarNfDoTitulo(client, codPgto);
  if (novo) {
    const txt = ` | NF ${nota.nnf} associada em ${hojeBR()}: R$ ${brl(valorAtendido)} atendido`;
    await client.query(
      `UPDATE dbpgto SET obs = left(COALESCE(obs,'') || $2, 500) WHERE cod_pgto = $1`, [codPgto, txt]);
  }
}
