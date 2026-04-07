// pages/api/vendas/dashboard/vendas-mensais.ts

import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import type { NextApiRequest, NextApiResponse } from 'next';
import { DateRange } from '@/data/vendas/dashboard';

type VendasChartData = {
  label: string;
  totalVendas: number;
  totalVendasAnterior?: number;
};

// Objeto de configuração para a query dinâmica.
// Define o intervalo para a série, o formato do label e o nível de agrupamento.
const rangeConfig = {
  hoje: {
    interval: '1 hour',
    format: 'HH24:00',
    truncate: 'hour',
    start: 'CURRENT_DATE',
    previousStart: "CURRENT_DATE - INTERVAL '1 day'",
    previousEnd: "CURRENT_DATE - INTERVAL '1 day' + INTERVAL '23 hours'",
  },
  ultima_semana: {
    interval: '1 day',
    format: 'DD/MM',
    truncate: 'day',
    start: "NOW() - INTERVAL '6 days'",
    previousStart: "NOW() - INTERVAL '13 days'",
    previousEnd: "NOW() - INTERVAL '7 days'",
  },
  ultimos_30_dias: {
    interval: '1 day',
    format: 'DD/MM',
    truncate: 'day',
    start: "NOW() - INTERVAL '29 days'",
    previousStart: "NOW() - INTERVAL '59 days'",
    previousEnd: "NOW() - INTERVAL '30 days'",
  },
  ultimo_trimestre: {
    interval: '1 month',
    format: 'Mon/YY',
    truncate: 'month',
    start: "NOW() - INTERVAL '2 months'",
    previousStart: "NOW() - INTERVAL '5 months'",
    previousEnd: "NOW() - INTERVAL '3 months'",
  },
  ultimo_ano: {
    interval: '1 month',
    format: 'Mon/YY',
    truncate: 'month',
    start: "NOW() - INTERVAL '11 months'",
    previousStart: "NOW() - INTERVAL '23 months'",
    previousEnd: "NOW() - INTERVAL '12 months'",
  },
  // Para 'todo_periodo', a lógica é tratada de forma especial abaixo.
  todo_periodo: {
    interval: '1 year',
    format: 'YYYY',
    truncate: 'year',
    start: '',
    previousStart: '',
    previousEnd: '',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VendasChartData[] | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const range = (req.query.range as DateRange) || 'ultimos_30_dias';
  const pool = getPgPool();
  let client;

  try {
    client = await pool.connect();
    let query;

    if (range === 'todo_periodo') {
      // Query especial para "Todo o Período", agrupando por ano.
      // Para todo período, mostramos apenas os dados do período atual (sem comparação)
      query = `
        SELECT
          TO_CHAR(DATE_TRUNC('year', data), 'YYYY') AS label,
          SUM(total) AS "totalVendas"
        FROM dbvenda
        WHERE (cancel IS NULL OR cancel <> 'S')
        GROUP BY DATE_TRUNC('year', data)
        ORDER BY DATE_TRUNC('year', data) ASC;
      `;
    } else {
      // Query dinâmica para todos os outros ranges, garantindo a linha do tempo completa.
      const config = rangeConfig[range];
      query = `
        WITH timeline AS (
          SELECT generate_series(
            DATE_TRUNC('${config.truncate}', ${config.start}),
            DATE_TRUNC('${config.truncate}', NOW()),
            '${config.interval}'::interval
          ) AS time_point
        ),
        current_period AS (
          SELECT
            t.time_point,
            TO_CHAR(t.time_point, '${config.format}') AS label,
            COALESCE(SUM(v.total), 0) AS "totalVendas"
          FROM
            timeline t
          LEFT JOIN
            dbvenda v ON DATE_TRUNC('${config.truncate}', v.data) = t.time_point
                      AND (v.cancel IS NULL OR v.cancel <> 'S')
          GROUP BY
            t.time_point
        ),
        previous_timeline AS (
          SELECT generate_series(
            DATE_TRUNC('${config.truncate}', ${config.previousStart}),
            DATE_TRUNC('${config.truncate}', ${config.previousEnd}),
            '${config.interval}'::interval
          ) AS time_point
        ),
        previous_period AS (
          SELECT
            pt.time_point + (
              DATE_TRUNC('${config.truncate}', ${config.start}) - 
              DATE_TRUNC('${config.truncate}', ${config.previousStart})
            ) AS normalized_time_point,
            COALESCE(SUM(v.total), 0) AS "totalVendasAnterior"
          FROM
            previous_timeline pt
          LEFT JOIN
            dbvenda v ON DATE_TRUNC('${config.truncate}', v.data) = pt.time_point
                      AND (v.cancel IS NULL OR v.cancel <> 'S')
          GROUP BY
            pt.time_point
        )
        SELECT
          c.label,
          c."totalVendas",
          COALESCE(p."totalVendasAnterior", 0) AS "totalVendasAnterior"
        FROM
          current_period c
        LEFT JOIN
          previous_period p ON c.time_point = p.normalized_time_point
        ORDER BY
          c.time_point ASC;
      `;
    }

    const result = await client.query(query);
    const jsonData = serializeBigInt(result.rows);

    res.status(200).json(jsonData);
  } catch (error) {
    console.error(
      `Erro ao buscar dados para o gráfico de vendas (range: ${range}):`,
      error,
    );
    res.status(500).json({ error: 'Erro interno do servidor.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
