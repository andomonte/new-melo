import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const { page = '1', perPage = '10', search = '' } = req.query;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const filiaisQuery = `
      SELECT * FROM tb_filial
      WHERE nome_filial ILIKE $1
      ORDER BY nome_filial ASC
      LIMIT $2 OFFSET $3;
    `;

    const filiaisResult = await client.query(filiaisQuery, [
      `%${search}%`,
      limit,
      offset,
    ]);
    const filiais = filiaisResult.rows;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tb_filial
      WHERE nome_filial ILIKE $1;
    `;

    const countResult = await client.query(countQuery, [`%${search}%`]);
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json(
      serializeBigInt({
        data: filiais,
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / limit) : 1,
          currentPage: count > 0 ? Number(page) : 1,
          perPage: limit,
        },
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
