import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Lista as colunas do dbprod (para o filtro avançado por coluna funcionar
 * mesmo sem produtos carregados — o filtro é o ponto de partida da busca).
 *
 * GET /api/produtos/colunas
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const pool = getPgPool();
    const r = await pool.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'db_manaus'
          AND table_name = 'dbprod'
        ORDER BY ordinal_position`,
    );
    return res
      .status(200)
      .json({ data: r.rows.map((row: any) => row.column_name) });
  } catch (err) {
    console.error('Erro ao listar colunas de produto:', err);
    return res.status(500).json({ error: 'Falha ao listar colunas do produto.' });
  }
}
