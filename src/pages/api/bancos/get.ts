import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string;
  status?: string;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '9999', search = '', status = '' }: GetParams = req.query;
  // status: 'ativo' | 'inativo' filtra; vazio/'todos' devolve todos (usado pelo cadastro).
  const filtraStatus = status === 'ativo' || status === 'inativo';
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = parseInt(page, 10);
    const perPageNumber = parseInt(perPage, 10);
    const offset = (pageNumber - 1) * perPageNumber;
    const searchTerm = `%${search}%`;

    const statusFilterSql = filtraStatus ? ` AND COALESCE(status, 'ativo') = $4` : '';

    // Consulta para buscar os bancos com paginação e filtro
    const bancosResult = await client.query(
      `
      SELECT *
      FROM dbbanco_cobranca
      WHERE nome ILIKE $1${statusFilterSql}
      ORDER BY banco
      OFFSET $2
      LIMIT $3
    `,
      filtraStatus ? [searchTerm, offset, perPageNumber, status] : [searchTerm, offset, perPageNumber],
    );

    const bancos = bancosResult.rows;

    // Consulta para obter a contagem total de bancos (para a paginação)
    const countResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM dbbanco_cobranca
      WHERE nome ILIKE $1${filtraStatus ? ' AND COALESCE(status, \'ativo\') = $2' : ''}
    `,
      filtraStatus ? [searchTerm, status] : [searchTerm],
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: bancos.map((banco) => serializeBigInt(banco)), // Aplica serializeBigInt a cada banco
      meta: {
        total: total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar bancos de cobrança:', error);
    res.status(500).json({ error: 'Erro ao buscar bancos de cobrança' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
