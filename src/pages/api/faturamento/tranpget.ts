import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPoolFilial } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const client = await (await getPgPoolFilial(req)).connect();

    const result = await client.query(`
      SELECT codtransp, nome
      FROM dbtransp
      WHERE nome IS NOT NULL
      ORDER BY nome
    `);

    client.release();

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar transportadoras:', error);
    res.status(500).json({ error: 'Erro ao buscar transportadoras' });
  }
}
