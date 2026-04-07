// pages/api/vendas/dashboard/top-products.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { getDateRange } from './dashboardUtils';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;
  try {
    // CORREÇÃO: A desestruturação agora busca os nomes corretos do tipo.
    const {
      sortBy = 'valor',
      range,
      customStartDate,
      customEndDate,
    } = req.query as {
      sortBy?: 'valor' | 'quantidade';
      range?: string;
      customStartDate?: string;
      customEndDate?: string;
    };

    let startDate: string;
    let endDate: string;
    //let filterType: string;

    // A lógica subsequente já estava correta e não precisa de alteração.
    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
      //    filterType = 'personalizado';
    } else {
      const calculatedRange = getDateRange(range || 'ultimos_30_dias');
      startDate = calculatedRange.startDate;
      endDate = calculatedRange.endDate;
      //      filterType = `predefinido: ${range || 'ultimos_30_dias'}`;
    }

    const orderByClause =
      sortBy === 'quantidade' ? 'SUM(i.qtd)' : 'SUM(i.qtd * i.prunit)';

    client = await getPgPool().connect();

    const sqlQuery = `
      SELECT
        p.codprod,
        p.descr AS "productName",
        SUM(i.qtd) AS "quantitySold",
        SUM(i.qtd * i.prunit) AS "totalRevenue"
      FROM dbvenda v
      JOIN dbitvenda i ON v.codvenda = i.codvenda
      JOIN dbprod p ON i.codprod = p.codprod
      WHERE
        v.data BETWEEN $1 AND $2
        AND COALESCE(v.cancel, 'N') != 'S'
      GROUP BY p.codprod, p.descr
      ORDER BY ${orderByClause} DESC
      LIMIT 5;
    `;

    const topProductsResult = await client.query(sqlQuery, [
      startDate,
      endDate,
    ]);

    const topProducts = topProductsResult.rows.map((p: any) => ({
      ...p,
      totalRevenue: parseFloat(p.totalRevenue || '0'),
      quantitySold: parseInt(p.quantitySold || '0', 10),
    }));

    res.status(200).json(serializeBigInt(topProducts));
  } catch (error) {
    res.status(500).json({
      message: 'Erro ao buscar os produtos mais vendidos.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
