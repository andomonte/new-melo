// API: Buscar compras dos últimos 3 meses de um cliente
// Retorna: data, total, prazoMedio

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'ID do cliente obrigatório.' });
    return;
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    // Buscar compras dos últimos 3 meses agrupadas por mês
    const result = await client.query(
      `
      SELECT 
        TO_CHAR(data, 'MM/YYYY') as mes,
        COUNT(*) as quantidade,
        SUM(total) as total,
        AVG(CASE 
          WHEN prazo ~ '^[0-9]+$' THEN CAST(prazo AS INTEGER)
          ELSE 0
        END) as prazo_medio
      FROM dbvenda
      WHERE codcli = $1
        AND (cancel IS NULL OR cancel = 'N')
        AND data >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY TO_CHAR(data, 'MM/YYYY'), DATE_TRUNC('month', data)
      ORDER BY DATE_TRUNC('month', data) DESC
      LIMIT 3
      `,
      [id],
    );

    const compras = result.rows.map((row: any) => ({
      data: row.mes,
      total: parseFloat(row.total || 0),
      prazoMedio: Math.round(parseFloat(row.prazo_medio || 0)),
    }));

    res.status(200).json(compras);
  } catch (error) {
    console.error('Erro ao buscar compras dos últimos 3 meses:', error);
    res.status(500).json({
      error: 'Erro ao buscar compras dos últimos 3 meses',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
