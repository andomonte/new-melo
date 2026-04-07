import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { id } = req.query;
  let client: PoolClient | undefined;

  if (!id) {
    res.status(400).json({ error: 'ID Obrigatório.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const filialQuery = `
      SELECT * FROM tb_filial WHERE codigo_filial = $1;
    `;
    const filialResult = await client.query(filialQuery, [Number(id)]);

    if (filialResult.rows.length === 0) {
      res.status(404).json({ error: 'Filial não encontrada' });
      return;
    }

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(filialResult.rows[0]));
  } catch (error) {
    console.log((error as Error).message);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
