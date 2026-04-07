import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { codcc, descr }: { codcc: string; descr: string } = req.body;

  if (!codcc || !descr) {
    res.status(400).json({ error: 'Código e descrição são obrigatórios.' });
    return;
  }

  const pool = getPgPool();
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    const updateResult = await client.query(
      `UPDATE dbcclien SET descr = $2 WHERE codcc = $1 RETURNING *`,
      [codcc, descr],
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({ data: serializeBigInt(updateResult.rows[0]) });
  } catch (errors) {
    console.log((errors as Error).message);
    res.status(500).json({ error: (errors as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
