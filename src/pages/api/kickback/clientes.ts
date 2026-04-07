import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { PoolClient } from 'pg';
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

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    if (req.method === 'GET') {
      const { page = 1, perPage = 10, search = '' } = req.query;
      const pageNumber = Number(page);
      const perPageNumber = Number(perPage);
      const offset = (pageNumber - 1) * perPageNumber;

      // Construir a cláusula WHERE para busca
      let whereClause = '';
      let searchValues: any[] = [];
      let paramIndex = 1;

      if (search && typeof search === 'string' && search.trim() !== '') {
        whereClause = `WHERE (codcli ILIKE $${paramIndex} OR class ILIKE $${
          paramIndex + 1
        })`;
        searchValues = [`%${search}%`, `%${search}%`];
        paramIndex += 2;
      }

      // Contar total de registros
      const countQuery = `
        SELECT COUNT(*) as total
        FROM cliente_kickback
        ${whereClause}
      `;
      const countResult = await client.query(countQuery, searchValues);
      const total = parseInt(countResult.rows[0].total, 10);

      // Buscar dados paginados
      const dataQuery = `
        SELECT *
        FROM cliente_kickback
        ${whereClause}
        ORDER BY id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      const dataResult = await client.query(dataQuery, [
        ...searchValues,
        perPageNumber,
        offset,
      ]);

      const lastPage = Math.ceil(total / perPageNumber);

      res.status(200).json(
        serializeBigInt({
          data: dataResult.rows,
          meta: {
            total,
            lastPage,
            currentPage: pageNumber,
            perPage: perPageNumber,
          },
        }),
      );
    } else if (req.method === 'POST') {
      const { codcli, class: classValue, status, g } = req.body;

      const insertQuery = `
        INSERT INTO cliente_kickback (codcli, class, status, g)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const result = await client.query(insertQuery, [
        codcli,
        classValue,
        status,
        g,
      ]);

      res.status(201).json(serializeBigInt(result.rows[0]));
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Erro na API de clientes kickback:', error);
    res.status(500).json({
      message: 'Erro interno do servidor',
      error: (error as Error).message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
