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
