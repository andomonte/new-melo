import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * GET /api/vendas/historico-produto?codprod=XXX
 * Retorna últimas vendas de um produto (12 meses)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { codprod } = req.query;
  if (!codprod || typeof codprod !== 'string') return res.status(400).json({ error: 'codprod obrigatório' });

  const pool = getPgPool();
  try {
    const queryVendas = `
      SELECT
        v.codvenda,
        v.data,
        v.status,
        v.codcli,
        COALESCE(c.nomefant, c.nome, '') as cliente,
        i.qtd,
        i.prunit,
        (i.qtd * i.prunit) as total
      FROM db_manaus.dbitvenda i
      JOIN db_manaus.dbvenda v ON i.codvenda = v.codvenda
      LEFT JOIN db_manaus.dbclien c ON v.codcli = c.codcli
      WHERE i.codprod = $1
        AND v.data >= NOW() - INTERVAL '12 months'
        AND COALESCE(v.cancel, 'N') <> 'S'
      ORDER BY v.data DESC
      LIMIT 20
    `;
    const resultVendas = await pool.query(queryVendas, [codprod]);

    const queryStats = `
      SELECT
        COALESCE(SUM(i.qtd), 0) as total_vendido,
        COUNT(DISTINCT v.codvenda) as qtd_vendas
      FROM db_manaus.dbitvenda i
      JOIN db_manaus.dbvenda v ON i.codvenda = v.codvenda
      WHERE i.codprod = $1
        AND v.data >= NOW() - INTERVAL '12 months'
        AND COALESCE(v.cancel, 'N') <> 'S'
    `;
    const resultStats = await pool.query(queryStats, [codprod]);

    return res.status(200).json({
      vendas: resultVendas.rows.map((r) => ({
        codvenda: r.codvenda,
        data: r.data ? new Date(r.data).toISOString() : null,
        status: r.status,
        cliente: r.cliente,
        qtd: Number(r.qtd) || 0,
        prunit: Number(r.prunit) || 0,
        total: Number(r.total) || 0,
      })),
      stats: {
        totalVendido: Number(resultStats.rows[0]?.total_vendido) || 0,
        qtdVendas: Number(resultStats.rows[0]?.qtd_vendas) || 0,
      },
    });
  } catch (error: any) {
    console.error('Erro historico-produto:', error);
    return res.status(500).json({ error: error.message });
  }
}
