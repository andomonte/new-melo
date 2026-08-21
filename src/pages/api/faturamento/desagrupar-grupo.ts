import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * POST /api/faturamento/desagrupar-grupo  { codgp }  (ou { codfat } de uma fatura do grupo)
 *
 * Desagrupa uma GP (grupo de pagamento) — espelha AGRUPAMENTO.GP_DESAGRUPAR do Oracle:
 *   - para cada fatura da GP: remove a associação (codgp = NULL, agp = 'N');
 *   - cancela a COBRANÇA AGRUPADA (dbreceb da GP);
 *   - remove a "fatura-GP" sintética (codfat 'GP...') criada no agrupamento;
 *   - desativa os registros de grupo_pagamento (best-effort).
 * Trava: não desagrupa se a cobrança agrupada já foi paga (dt_pgto preenchido).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    let { codgp, codfat } = req.body || {};

    // Se veio codfat, descobre a GP dele.
    if (!codgp && codfat) {
      const r = await client.query(
        `SELECT codgp FROM db_manaus.dbfatura WHERE codfat = $1`,
        [String(codfat)],
      );
      codgp = r.rows[0]?.codgp;
    }
    codgp = Number(codgp);
    if (!codgp) return res.status(400).json({ erro: 'GP (codgp) inválida ou não encontrada.' });

    // Faturas do grupo (membros reais, exclui a fatura-GP sintética 'GP...').
    const membros = await client.query(
      `SELECT codfat FROM db_manaus.dbfatura
        WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );
    if (membros.rows.length === 0) {
      return res.status(404).json({ erro: 'Nenhuma fatura para desagrupar nesta GP.' });
    }

    // Trava: cobrança agrupada já paga?
    const paga = await client.query(
      `SELECT 1 FROM db_manaus.dbreceb
        WHERE codgp = $1 AND cancel = 'N' AND dt_pgto IS NOT NULL LIMIT 1`,
      [codgp],
    );
    if (paga.rows.length > 0) {
      return res.status(400).json({
        erro: 'A cobrança agrupada já possui parcela paga — não é possível desagrupar.',
      });
    }

    await client.query('BEGIN');

    // 1. Cancela a cobrança agrupada (dbreceb da GP).
    const recCancel = await client.query(
      `UPDATE db_manaus.dbreceb SET cancel = 'S' WHERE codgp = $1 AND cancel = 'N'`,
      [codgp],
    );

    // 2. Remove a fatura-GP sintética criada no agrupamento (codfat 'GP...').
    await client.query(
      `DELETE FROM db_manaus.dbfatura WHERE codgp = $1 AND codfat LIKE 'GP%'`,
      [codgp],
    );

    // 3. Desassocia as faturas membros (codgp = NULL, agp = 'N').
    const upd = await client.query(
      `UPDATE db_manaus.dbfatura SET codgp = NULL, agp = 'N'
        WHERE codgp = $1 AND codfat NOT LIKE 'GP%'`,
      [codgp],
    );

    // 4. Desativa os registros de grupo_pagamento (se as tabelas existirem).
    await client
      .query(
        `UPDATE db_manaus.grupo_pagamento SET status = 'DESAGRUPADO' WHERE codigo_gp = $1`,
        [codgp],
      )
      .catch(() => {});
    await client
      .query(
        `DELETE FROM db_manaus.grupo_pagamento_fatura
          WHERE grupo_pagamento_id IN (
            SELECT id FROM db_manaus.grupo_pagamento WHERE codigo_gp = $1
          )`,
        [codgp],
      )
      .catch(() => {});

    await client.query('COMMIT');

    return res.status(200).json({
      sucesso: true,
      codgp,
      faturasDesagrupadas: upd.rowCount ?? membros.rows.length,
      cobrancasCanceladas: recCancel.rowCount ?? 0,
      faturas: membros.rows.map((r) => r.codfat),
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Erro ao desagrupar GP:', error);
    return res.status(500).json({ erro: 'Erro ao desagrupar a GP.', detalhes: error.message });
  } finally {
    client.release();
  }
}
