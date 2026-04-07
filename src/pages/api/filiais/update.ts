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

  const { codigo_filial, nome_filial }: Filial = req.body;

  if (!codigo_filial || !nome_filial) {
    res
      .status(400)
      .json({ error: 'Nome filial e código filial são obrigatórios.' });
    return;
  }

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const updateQuery = `
      UPDATE tb_filial
      SET nome_filial = $1
      WHERE codigo_filial = $2
      RETURNING *;
    `;

    const result = await client.query(updateQuery, [
      nome_filial,
      codigo_filial,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Filial não encontrada.' });
      return;
    }

    const updatedFilial = result.rows[0];

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(updatedFilial),
      });
  } catch (error) {
    console.log('Erro ao atualizar filial:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
