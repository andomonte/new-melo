import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { GetParams } from '@/data/common/getParams';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { search = '' }: GetParams = req.query;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const filiaisQuery = `
      SELECT * FROM tb_filial
      WHERE nome_filial ILIKE $1;
    `;

    const filiaisResult = await client.query(filiaisQuery, [`%${search}%`]);
    const filiais = filiaisResult.rows;

    return res.status(200).json(
      serializeBigInt({
        data: filiais,
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar filiais:', error);
    res.status(500).json({
      message: 'Erro ao buscar filiais. Tente novamente ou contate o suporte.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
