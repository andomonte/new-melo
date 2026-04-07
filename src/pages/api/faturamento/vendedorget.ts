import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const client = await getPgPool().connect();

    const result = await client.query(`
      SELECT codvend, nome
      FROM dbvend
      WHERE nome IS NOT NULL
      ORDER BY nome
    `);

    client.release();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar vendedores:', error);
    res.status(500).json({ error: 'Erro ao buscar vendedores' });
  }
}
