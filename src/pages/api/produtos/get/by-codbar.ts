import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { codbar } = req.query;

  if (!codbar) {
    res.status(400).json({ error: 'ID Obrigatório.' });
    return;
  }

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    const produtoResult = await client.query(
      `SELECT * FROM dbprod WHERE codbar = $1 LIMIT 1`,
      [codbar as string],
    );

    if (produtoResult.rows.length === 0) {
      res.status(404).json({ error: 'Produto não encontrado' });
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(produtoResult.rows[0]));
  } catch (errors) {
    console.log((errors as Error).message);
    res.status(500).json({ error: (errors as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
