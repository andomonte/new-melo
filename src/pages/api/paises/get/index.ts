import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { GetParams } from '@/data/common/getParams';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 999, search = '' }: GetParams = req.query;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
    const offset = (pageNumber - 1) * perPageNumber;

    // Construir a cláusula WHERE
    const whereClause = search ? 'WHERE descricao ILIKE $1' : '';
    const queryParams = search ? [`%${search}%`] : [];

    // Adicionar parâmetros de paginação
    const limitOffset = search ? 'OFFSET $2 LIMIT $3' : 'OFFSET $1 LIMIT $2';

    if (search) {
      queryParams.push(offset.toString(), perPageNumber.toString());
    } else {
      queryParams.push(offset.toString(), perPageNumber.toString());
    }

    // Buscar os países
    const paisesResult = await client.query(
      `SELECT * FROM db_manaus.dbpais ${whereClause} ORDER BY descricao ${limitOffset}`,
      queryParams,
    );

    // Contar o total
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM db_manaus.dbpais ${whereClause}`,
      countParams,
    );

    const paises = paisesResult.rows;
    const count = parseInt(countResult.rows[0].total, 10);

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: paises.map((pais) => serializeBigInt(pais)),
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / perPageNumber) : 1,
          currentPage: count > 0 ? pageNumber : 1,
          perPage: perPageNumber,
        },
      });
  } catch (error) {
    console.error('Erro ao buscar países:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
