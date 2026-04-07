import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: 'ID Obrigatório.' });
    return;
  }

  try {
    const pool = getPgPool();

    const result = await pool.query(
      'SELECT * FROM dbprod WHERE codprod = $1',
      [id as string]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }

    res.status(200).setHeader('Content-Type', 'application/json').json(result.rows[0]);
  } catch (errors) {
    console.log((errors as Error).message);
    res.status(500).json((errors as Error).message);
  }
}
