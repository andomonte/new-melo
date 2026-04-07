// pages/api/vendas/dashboard/sales-overview.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import {
  SalesOverviewDataPoint,
  getDateRange,
  getDynamicTrunc,
} from './dashboardUtils';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<
    SalesOverviewDataPoint[] | { message: string; error?: string }
  >,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  let client: PoolClient | undefined;
  try {
    const { range = 'ultimos_30_dias' } = req.query as { range?: string };
    const { startDate, endDate } = getDateRange(range);

    client = await getPgPool().connect();

    // Utiliza a função auxiliar para determinar o agrupamento ideal
    const trunc = await getDynamicTrunc(client, range);

    const salesOverviewResult = await client.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC($3, data), 'YYYY-MM-DD') AS label,
        COALESCE(SUM(total), 0) AS revenue
      FROM dbvenda
      WHERE data BETWEEN $1 AND $2 AND COALESCE(cancel, 'N') != 'S'
      GROUP BY label ORDER BY label ASC;
      `,
      [startDate, endDate, trunc],
    );

    const salesOverview = salesOverviewResult.rows.map((row: any) => ({
      ...row,
      revenue: parseFloat(row.revenue || '0'),
    }));

    res.status(200).json(serializeBigInt(salesOverview));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [sales-overview]:', error);
    res.status(500).json({
      message: 'Erro ao buscar os dados do gráfico.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
