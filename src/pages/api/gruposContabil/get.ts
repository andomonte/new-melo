import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';
import { PoolClient } from 'pg';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  let client: PoolClient | undefined;

  const { page = '1', perPage = '10', search = '' } = req.query;

  try {
    const pool = getPgPool();
    client = await pool.connect();

    const offset = (Number(page) - 1) * Number(perPage);
    const limit = Number(perPage);

    const query = `
      SELECT * FROM dbgpprod_contabil
      WHERE descr ILIKE $1
      LIMIT $2 OFFSET $3;
    `;

    const result = await client.query(query, [`%${search}%`, limit, offset]);
    const gruposContabeis = result.rows;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM dbgpprod_contabil
      WHERE descr ILIKE $1;
    `;

    const countResult = await client.query(countQuery, [`%${search}%`]);
    const count = parseInt(countResult.rows[0].total, 10);

    res.status(200).json({
      data: gruposContabeis,
      meta: {
        total: count,
        lastPage: count > 0 ? Math.ceil(count / limit) : 1,
        currentPage: count > 0 ? Number(page) : 1,
        perPage: limit,
      },
    });
  } catch (error) {
    console.log('Erro ao buscar grupos contábeis:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (client) client.release();
  }
}
