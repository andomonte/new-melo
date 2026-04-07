import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const { search = '', page = 1, perPage = 10 } = req.query;
  const { filial_melo: filial } = parseCookies({ req });

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie.' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const currentPage = Number(page);
    const itemsPerPage = Number(perPage);
    const offset = (currentPage - 1) * itemsPerPage;

    // Construir a cláusula WHERE para busca
    let whereClause = '';
    const queryParams: any[] = [];

    if (search) {
      // Busca por código, descrição ou referência
      const isNumericSearch = /^\d+$/.test(search as string);

      if (isNumericSearch) {
        // Se for numérico, buscar principalmente por código
        whereClause = 'WHERE p.codprod ILIKE $1 OR p.descr ILIKE $1';
        queryParams.push(`%${search}%`);
      } else {
        // Se for texto, buscar principalmente por descrição
        whereClause =
          'WHERE p.descr ILIKE $1 OR p.ref ILIKE $1 OR p.codprod ILIKE $1';
        queryParams.push(`%${search}%`);
      }
    }

    // Contar o total de registros
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM db_manaus.dbprod p 
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // Buscar os produtos
    const dataQuery = `
      SELECT p.codprod, p.descr, p.ref, p.ativo
      FROM db_manaus.dbprod p 
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN p.codprod ILIKE $${queryParams.length + 1} THEN 1
          WHEN p.descr ILIKE $${queryParams.length + 2} THEN 2
          ELSE 3
        END,
        p.descr ASC
      LIMIT $${queryParams.length + 3} OFFSET $${queryParams.length + 4}
    `;

    const searchParamStart = search ? `${search}%` : '';

    const dataParams = [
      ...queryParams,
      searchParamStart, // Para ordenação por código que começa com o termo
      searchParamStart, // Para ordenação por descrição que começa com o termo
      itemsPerPage,
      offset,
    ];

    const dataResult = await client.query(dataQuery, dataParams);

    res.status(200).json({
      data: dataResult.rows.map((produto) => serializeBigInt(produto)),
      meta: {
        total,
        lastPage: Math.max(1, Math.ceil(total / itemsPerPage)),
        currentPage: Math.max(1, currentPage),
        perPage: itemsPerPage,
        firstPage: 1,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar produtos para autocomplete:', error);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
