import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
import { GetParams } from '@/data/common/getParams';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'manaus';

  const { page = 1, perPage = 10, search = '' }: GetParams = req.query;
  const pool = getPgPool(filial);
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
    const offset = (pageNumber - 1) * perPageNumber;

    let whereClause = '';
    const queryParams: any[] = [];

    if (search) {
      whereClause = `WHERE nome ILIKE $1 OR codcomprador ILIKE $1`;
      queryParams.push(`%${search}%`);
    }

    const dataQuery = `
      SELECT codcomprador, nome 
      FROM db_manaus.dbcompradores
      ${whereClause}
      ORDER BY nome ASC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    const dataParams = [...queryParams, perPageNumber, offset];

    const countQuery = `SELECT COUNT(*) FROM db_manaus.dbcompradores ${whereClause}`;
    const countParams = [...queryParams];

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuery, dataParams),
      client.query(countQuery, countParams),
    ]);

    const compradores = dataResult.rows;
    const count = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      data: compradores.map((comprador) => serializeBigInt(comprador)),
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / perPageNumber) : 1,
        currentPage: count > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar compradores:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
