import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    const { search } = req.query;

    let query = `
      SELECT
        cod_ccusto,
        descr,
        tipo
      FROM dbccusto
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (
        cod_ccusto ILIKE $${paramIndex} OR
        descr ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY cod_ccusto ASC`;

    const result = await client.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Erro ao buscar centros de custo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar centros de custo',
      error: (error as Error).message
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
