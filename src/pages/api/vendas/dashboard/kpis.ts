// pages/api/vendas/dashboard/kpis.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { getDateRange, KpiData } from './dashboardUtils';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
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

    const kpiResult = await client.query(
      `
      -- Query simplificada: removemos o SUM(total)
      SELECT
        (SELECT COUNT(*) FROM dbvenda WHERE data BETWEEN $1 AND $2 AND COALESCE(cancel, 'N') != 'S') AS "totalSales",
        (SELECT COUNT(*) FROM dbclien WHERE datacad BETWEEN $1 AND $2) AS "newClients";
      `,
      [startDate, endDate],
    );

    const kpiRaw = kpiResult.rows[0];
    if (!kpiRaw) throw new Error('Dados de KPI não encontrados');

    const kpiData: KpiData = {
      totalSales: parseInt(kpiRaw.totalSales || '0', 10),
      newClients: parseInt(kpiRaw.newClients || '0', 10),
    };

    res.status(200).json(serializeBigInt(kpiData));
  } catch (error) {
    console.error('❌ ERRO NO ENDPOINT [kpis]:', error);
    res.status(500).json({
      message: 'Erro ao buscar os KPIs.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
