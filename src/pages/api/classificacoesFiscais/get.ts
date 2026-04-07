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
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { page = 1, perPage = 10, search = '' }: GetParams = req.query;
  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
    const offset = (pageNumber - 1) * perPageNumber;

    // Construir a cláusula WHERE
    const whereClause = search ? 'WHERE ncm ILIKE $1' : '';
    const queryParams = search ? [`%${search}%`] : [];

    // Adicionar parâmetros de paginação
    const limitOffset = search ? 'OFFSET $2 LIMIT $3' : 'OFFSET $1 LIMIT $2';

    if (search) {
      queryParams.push(offset.toString(), perPageNumber.toString());
    } else {
      queryParams.push(offset.toString(), perPageNumber.toString());
    }

    // Buscar as classificações fiscais
    const classificacoesFiscaisResult = await client.query(
      `SELECT * FROM dbclassificacao_fiscal ${whereClause} ORDER BY ncm ${limitOffset}`,
      queryParams,
    );

    // Contar o total
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await client.query(
      `SELECT COUNT(*) as total FROM dbclassificacao_fiscal ${whereClause}`,
      countParams,
    );

    const classificacoesFiscais = classificacoesFiscaisResult.rows;
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: classificacoesFiscais.map((classificacao) =>
        serializeBigInt(classificacao),
      ),
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / perPageNumber) : 1,
        currentPage: count > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar classificações fiscais:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) {
      client.release();
    }
  }
}
