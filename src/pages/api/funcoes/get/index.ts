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

    const searchTerm = `%${search}%`;

    const functionsQuery = `
      SELECT id_functions, descricao, sigla, "usadoEm"
      FROM tb_login_functions
      WHERE descricao ILIKE $1 OR sigla ILIKE $1 OR "usadoEm" ILIKE $1
      ORDER BY descricao ASC
      LIMIT $2 OFFSET $3;
    `;

    const functionsResult = await client.query(functionsQuery, [
      searchTerm,
      limit,
      offset,
    ]);
    const functions = functionsResult.rows;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM tb_login_functions
      WHERE descricao ILIKE $1 OR sigla ILIKE $1 OR "usadoEm" ILIKE $1;
    `;

    const countResult = await client.query(countQuery, [searchTerm]);
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json(
      serializeBigInt({
        data: functions,
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / limit) : 1,
          currentPage: count > 0 ? Number(page) : 1,
          perPage: limit,
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar funções:', error);
    res.status(500).json({
      message: 'Erro ao buscar funções. Tente novamente ou contate o suporte.',
      error: (error as Error).message,
    });
  } finally {
    if (client) client.release();
  }
}
