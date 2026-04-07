import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'ID da marca é obrigatório' });
      return;
    }

    const pool = getPgPool();
    client = await pool.connect();

    const query = `
      SELECT * FROM dbmarcas
      WHERE codmarca = $1;
    `;

    const result = await client.query(query, [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Marca não encontrada' });
      return;
    }

    const marca = result.rows[0];

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json(serializeBigInt(marca));
  } catch (error) {
    console.error('Erro ao buscar marca:', error);
    res.status(500).json({
      error: 'Erro interno ao buscar a marca.',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
