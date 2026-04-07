import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { GetParams } from '@/data/common/getParams';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' }: GetParams = req.query;
  let client;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);
    const searchTerm = `%${search}%`;

    const query = `
      SELECT "CODIGO_TELA", "NOME_TELA", "PATH_TELA"
      FROM tb_telas
      WHERE "NOME_TELA" ILIKE $1 OR "PATH_TELA" ILIKE $2
      ORDER BY "NOME_TELA" ASC
      LIMIT $3 OFFSET $4;
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM tb_telas
      WHERE "NOME_TELA" ILIKE $1 OR "PATH_TELA" ILIKE $2;
    `;

    const dataResult = await client.query(query, [
      searchTerm,
      searchTerm,
      limit,
      offset,
    ]);
    const countResult = await client.query(countQuery, [
      searchTerm,
      searchTerm,
    ]);

    const total = parseInt(countResult.rows[0]?.count || '0', 10);
    const lastPage = total > 0 ? Math.ceil(total / Number(perPage)) : 1;
    const currentPage = total > 0 ? Number(page) : 1;

    return res.status(200).json(
      serializeBigInt({
        data: dataResult.rows,
        meta: {
          total,
          lastPage,
          currentPage,
          perPage: Number(perPage),
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar telas:', error);
    return res.status(500).json({ error: 'Erro ao buscar telas.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
