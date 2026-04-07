// src/pages/api/compras/dashboard/status-requisicoes.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { StatusRequisicao, STATUS_LABELS, getDateRange } from './dashboardUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusRequisicao[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  let client: any;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const range = (req.query.range as string) || 'ultimos_30_dias';
    const { startDate, endDate } = getDateRange(range);

    try {
      // Query para contar requisições por status
      const query = `
        WITH contagem AS (
          SELECT
            req_status AS status,
            COUNT(*) AS quantidade
          FROM db_manaus.cmp_requisicao
          WHERE req_data BETWEEN $1 AND $2
          GROUP BY req_status
        ),
        total AS (
          SELECT SUM(quantidade) AS total FROM contagem
        )
        SELECT
          c.status,
          c.quantidade,
          CASE
            WHEN t.total > 0 THEN ROUND((c.quantidade::numeric / t.total::numeric) * 100, 1)
            ELSE 0
          END AS percentual
        FROM contagem c
        CROSS JOIN total t
        ORDER BY c.quantidade DESC
      `;

      const result = await client.query(query, [startDate, endDate]);

      const statusRequisicoes: StatusRequisicao[] = result.rows.map((row: any) => ({
        status: row.status,
        statusLabel: STATUS_LABELS[row.status] || row.status,
        quantidade: parseInt(row.quantidade) || 0,
        percentual: parseFloat(row.percentual) || 0,
      }));

      res.status(200).json(serializeBigInt(statusRequisicoes));
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar status das requisições:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
