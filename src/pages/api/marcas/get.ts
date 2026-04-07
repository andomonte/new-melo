import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { GetParams } from '@/data/common/getParams';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  let client: PoolClient | undefined;

  try {
    const { page = 1, perPage = 10, search = '' }: GetParams = req.query;

    console.log('📊 API Marcas - Params recebidos:', { page, perPage, search });

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const pool = getPgPool();
    client = await pool.connect();

    // Construir condição WHERE para busca
    let whereCondition = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereCondition = `WHERE descr ILIKE $${paramIndex} OR codmarca ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Query para buscar marcas com paginação
    const marcasQuery = `
      SELECT * FROM dbmarcas
      ${whereCondition}
      ORDER BY codmarca
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total FROM dbmarcas
      ${whereCondition};
    `;

    console.log('🔍 Query:', marcasQuery);
    console.log('📝 Params:', [...queryParams, limit, offset]);

    const marcasResult = await client.query(marcasQuery, [
      ...queryParams,
      limit,
      offset,
    ]);

    const countResult = await client.query(countQuery, queryParams);

    const marcas = marcasResult.rows;
    const total = parseInt(countResult.rows[0].total);

    console.log(`✅ Encontradas ${marcas.length} marcas de ${total} total`);

    res
      .status(200)
      .setHeader('Content-Type', 'application/json')
      .json({
        data: serializeBigInt(marcas),
        meta: {
          total: total,
          lastPage: total > 0 ? Math.ceil(total / Number(perPage)) : 1,
          currentPage: total > 0 ? Number(page) : 1,
          perPage: Number(perPage),
        },
      });
  } catch (error) {
    console.error('Erro ao buscar marcas:', error);
    res.status(500).json({
      error: 'Erro interno ao buscar marcas.',
      message: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
