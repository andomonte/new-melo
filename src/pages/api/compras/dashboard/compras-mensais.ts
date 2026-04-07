// pages/api/compras/dashboard/compras-mensais.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { ComprasMensais, getDateRange, getDynamicTrunc } from './dashboardUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ComprasMensais[] | { error: string }>,
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

    // Determinar o agrupamento dinâmico
    const trunc = await getDynamicTrunc(client, range);

    // Configuração de formato de label baseado no agrupamento
    const labelFormat = trunc === 'year' ? 'YYYY' : trunc === 'month' ? 'MM/YYYY' : 'DD/MM';

    try {
      // Query para buscar compras agrupadas por período
      let query: string;

      if (range === 'todo_periodo' && trunc === 'year') {
        // Para todo período agrupado por ano
        query = `
          WITH compras_agrupadas AS (
            SELECT
              DATE_TRUNC('${trunc}', orc_data) AS periodo,
              SUM(orc_valor_total) AS total
            FROM db_manaus.cmp_ordem_compra
            WHERE orc_status IN ('A', 'F')
              AND orc_data IS NOT NULL
              AND orc_valor_total < 100000000
            GROUP BY DATE_TRUNC('${trunc}', orc_data)
          )
          SELECT
            TO_CHAR(periodo, '${labelFormat}') AS label,
            COALESCE(total, 0) AS "totalCompras"
          FROM compras_agrupadas
          ORDER BY periodo
        `;
      } else {
        // Para períodos com comparação de período anterior
        const periodDays =
          range === 'hoje' ? 1 :
          range === 'ultima_semana' ? 7 :
          range === 'ultimos_30_dias' ? 30 :
          range === 'ultimo_trimestre' ? 90 :
          range === 'ultimo_ano' ? 365 : 30;

        query = `
          WITH periodo_atual AS (
            SELECT
              DATE_TRUNC('${trunc}', orc_data) AS periodo,
              SUM(orc_valor_total) AS total
            FROM db_manaus.cmp_ordem_compra
            WHERE orc_status IN ('A', 'F')
              AND orc_data BETWEEN $1 AND $2
              AND orc_valor_total < 100000000
            GROUP BY DATE_TRUNC('${trunc}', orc_data)
          ),
          periodo_anterior AS (
            SELECT
              DATE_TRUNC('${trunc}', orc_data + interval '${periodDays} days') AS periodo,
              SUM(orc_valor_total) AS total
            FROM db_manaus.cmp_ordem_compra
            WHERE orc_status IN ('A', 'F')
              AND orc_data BETWEEN ($1::date - interval '${periodDays} days') AND ($2::date - interval '${periodDays} days')
              AND orc_valor_total < 100000000
            GROUP BY DATE_TRUNC('${trunc}', orc_data + interval '${periodDays} days')
          ),
          series AS (
            SELECT generate_series(
              DATE_TRUNC('${trunc}', $1::date),
              DATE_TRUNC('${trunc}', $2::date),
              interval '1 ${trunc}'
            ) AS periodo
          )
          SELECT
            TO_CHAR(s.periodo, '${labelFormat}') AS label,
            COALESCE(pa.total, 0) AS "totalCompras",
            COALESCE(pant.total, 0) AS "totalComprasAnterior"
          FROM series s
          LEFT JOIN periodo_atual pa ON s.periodo = pa.periodo
          LEFT JOIN periodo_anterior pant ON s.periodo = pant.periodo
          ORDER BY s.periodo
        `;
      }

      const result = range === 'todo_periodo' && trunc === 'year'
        ? await client.query(query)
        : await client.query(query, [startDate, endDate]);

      const comprasMensais: ComprasMensais[] = result.rows.map((row: any) => ({
        label: row.label,
        totalCompras: parseFloat(row.totalCompras) || 0,
        totalComprasAnterior: row.totalComprasAnterior !== undefined
          ? parseFloat(row.totalComprasAnterior) || 0
          : undefined,
      }));

      res.status(200).json(serializeBigInt(comprasMensais));
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error) {
    console.error('Erro ao buscar compras mensais:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}
