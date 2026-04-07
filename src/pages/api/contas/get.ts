import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient'; // Importe sua função getPgPool
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string; // O termo de busca para filtrar as contas
  banco?: string; // Filtro por banco
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { page = '1', perPage = '9999', search = '', banco }: GetParams = req.query;
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
    const searchTerm = `%${search}%`; // Termo de busca para usar em LIKE

    // Construir query dinâmica baseada no filtro de banco
    let whereClause = `
      banco ILIKE $1 OR
      tipo ILIKE $1 OR
      nroconta ILIKE $1 OR
      agencia ILIKE $1
    `;
    const queryParams: any[] = [searchTerm];
    
    if (banco) {
      whereClause = `banco = $${queryParams.length + 1} AND (${whereClause})`;
      queryParams.push(banco);
    }

    // Ajustar índices dos parâmetros de paginação
    const offsetParamIndex = queryParams.length + 1;
    const limitParamIndex = queryParams.length + 2;
    queryParams.push(offset, perPageNumber);

    // Consulta para buscar as contas com paginação e filtro
    const contasResult = await client.query(
      `
      SELECT id, banco, tipo, nroconta, convenio, variacao, carteira, melo, agencia
      FROM dbdados_banco
      WHERE ${whereClause}
      ORDER BY id
      OFFSET $${offsetParamIndex}
      LIMIT $${limitParamIndex}
    `,
      queryParams,
    );

    const contas = contasResult.rows;

    // Parâmetros para count query
    const countParams = [searchTerm];
    if (banco) {
      countParams.push(banco);
    }

    // Consulta para obter a contagem total de contas (para a paginação)
    const countResult = await client.query(
      `
      SELECT COUNT(*) as total
      FROM dbdados_banco
      WHERE ${whereClause.replace(`OFFSET $${offsetParamIndex}`, '').replace(`LIMIT $${limitParamIndex}`, '')}
    `,
      countParams,
    );
    const total = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: contas.map((conta) => serializeBigInt(conta)), // Aplica serializeBigInt a cada conta
      meta: {
        total: total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    res.status(500).json({ error: 'Erro ao buscar contas' });
  } finally {
    if (client) {
      client.release();
    }
  }
}