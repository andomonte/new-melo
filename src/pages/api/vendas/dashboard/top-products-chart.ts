// pages/api/vendas/dashboard/top-products-chart.ts

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
    const {
      range = 'ultimos_30_dias',
      customStartDate,
      customEndDate,
    } = req.query as {
      range?: string;
      customStartDate?: string;
      customEndDate?: string;
    };

    let startDate: string;
    let endDate: string;
    //    let filterType: string;

    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
      //filterType = 'personalizado';
    } else {
      const calculatedRange = getDateRange(range || 'ultimos_30_dias');
      startDate = calculatedRange.startDate;
      endDate = calculatedRange.endDate;
      // filterType = `predefinido: ${range || 'ultimos_30_dias'}`;
    }

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
      ORDER BY SUM(i.qtd * i.prunit) DESC
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
    console.error('[ERROR] Top Products Chart:', error);
    res.status(500).json({
      message: 'Erro ao buscar os produtos mais vendidos para o gráfico.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
