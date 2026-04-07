import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient'; // ← troca para pool por filial
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies'; // ← ler a filial do cookie

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = 1, perPage = 10, search = '' } = req.query;
  let client: PoolClient | undefined;

  try {
    const { filial_melo } = parseCookies({ req });
    if (!filial_melo || !String(filial_melo).trim()) {
      return res
        .status(400)
        .json({ error: 'Cookie "filial_melo" ausente ou inválido.' });
    }

    const pool = getPgPool(filial_melo);
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
    const offset = (pageNumber - 1) * perPageNumber;

    // Construir a cláusula WHERE
    const whereClause = search ? 'WHERE codcf ILIKE $1 OR descr ILIKE $1' : '';
    const queryParams = search ? [`%${search}%`] : [];

    // Adicionar parâmetros de paginação
    const limitOffset = search ? 'OFFSET $2 LIMIT $3' : 'OFFSET $1 LIMIT $2';

    if (search) {
      queryParams.push(offset.toString(), perPageNumber.toString());
    } else {
      queryParams.push(offset.toString(), perPageNumber.toString());
    }

    // Buscar as classes de fornecedor
    const classesFornecedorResult = await client.query(
      `SELECT * FROM db_manaus.dbclassefornecedor ${whereClause} ORDER BY codcf ${limitOffset}`,
      queryParams,
    );

    // Contar o total
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM db_manaus.dbclassefornecedor ${whereClause}`,
      countParams,
    );

    const classesFornecedor = classesFornecedorResult.rows;
    const count = parseInt(countResult.rows[0].total, 10);

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: classesFornecedor.map((classe) => serializeBigInt(classe)),
        meta: {
          total: count,
          lastPage: count > 0 ? Math.ceil(count / perPageNumber) : 1,
          currentPage: count > 0 ? pageNumber : 1,
          perPage: perPageNumber,
        },
      });
  } catch (error) {
    console.error('Erro ao buscar classes de fornecedor:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
