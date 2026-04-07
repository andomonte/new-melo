import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { Filial } from '@/data/filiais/filiais';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const data: Filial = req.body;
  const saveData = {
    nome_filial: data.nome_filial,
  };

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const insertQuery = `
      INSERT INTO tb_filial (nome_filial)
      VALUES ($1)
      RETURNING *;
    `;

    const filialResult = await client.query(insertQuery, [
      saveData.nome_filial,
    ]);
    const filial = filialResult.rows[0];

    res
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(filial),
      });
  } catch (error) {
    console.error('Erro ao criar filial:', error);
    return res.status(500).json({
      message: 'Erro interno ao criar filial.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
