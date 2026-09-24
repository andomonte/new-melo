import type { PoolClient, Pool } from 'pg';

/**
 * Fila de impressão da DANFE (tabela legada `fin_impressao`, consumida pelo Robô DANFE).
 *
 * O Robô faz polling em `fin_impressao WHERE imp_impresso='N' AND imp_fila=<id>`, usa
 * `imp_aut_id` como codfat, baixa o PDF em /api/faturamento/pdf-nota e imprime.
 *
 * Colunas: imp_aut_id (numeric = codfat), imp_data, imp_impresso ('N'/'S'), imp_fila (numeric).
 *
 * OBS. de tipos: `imp_aut_id` é numeric e o `codfat` chega como varchar com zeros à
 * esquerda ('001027750'). Em query parametrizada, o Postgres infere o tipo do parâmetro
 * pela coluna, então '001027750' vira numeric 1027750 tanto no INSERT quanto no dedup —
 * mantendo a comparação consistente.
 */

type Executor = Pick<PoolClient | Pool, 'query'>;

/**
 * Enfileira a DANFE de uma fatura para o Robô de Impressão.
 *
 * Idempotente: por padrão não insere se já houver uma linha PENDENTE (imp_impresso='N')
 * para a fatura. Com `somenteSeInexistente=true`, não insere se existir QUALQUER linha
 * (pendente ou já impressa) — usado em gatilhos secundários para não reimprimir.
 *
 * Nunca lança: falha de fila não deve bloquear a emissão/recebimento (apenas loga).
 *
 * @returns true se inseriu uma nova linha; false caso contrário.
 */
export async function enfileirarImpressaoDanfe(
  db: Executor,
  codfat: string | number | null | undefined,
  opts: { fila?: number; somenteSeInexistente?: boolean } = {},
): Promise<boolean> {
  const { fila = 1, somenteSeInexistente = false } = opts;
  if (codfat === null || codfat === undefined || String(codfat).trim() === '') return false;
  const cod = String(codfat).trim();
  try {
    const filtro = somenteSeInexistente ? '' : `AND imp_impresso = 'N'`;
    const existe = await db.query(
      `SELECT 1 FROM fin_impressao WHERE imp_aut_id = $1 ${filtro} LIMIT 1`,
      [cod],
    );
    if (existe.rows.length > 0) return false;

    await db.query(
      `INSERT INTO fin_impressao (imp_aut_id, imp_data, imp_impresso, imp_fila)
       VALUES ($1, NOW(), 'N', $2)`,
      [cod, fila],
    );
    return true;
  } catch (err: any) {
    console.error(
      `[filaImpressao] Falha ao enfileirar DANFE (codfat=${cod}): ${err?.message ?? err}`,
    );
    return false;
  }
}
