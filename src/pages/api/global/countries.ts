import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q } = req.query;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  // Default to some pool if filial is missing, or handle error
  // Assuming getPgPool handles default or throws
  const pool = getPgPool(filial); 

  try {
    let query = `
      SELECT codpais, descricao 
      FROM dbpais 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q && typeof q === 'string') {
        const searchTerm = `%${q.toUpperCase()}%`;
        // Check if it's a number to search by ID as well
        if (!isNaN(Number(q))) {
            query += ` AND (descricao ILIKE $1 OR codpais = $2)`;
            params.push(searchTerm, Number(q));
        } else {
            query += ` AND descricao ILIKE $1`;
            params.push(searchTerm);
        }
    }

    query += ` ORDER BY descricao ASC LIMIT 50`;

    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        res.status(200).json(result.rows);
    } finally {
        client.release();
    }
  } catch (error: any) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Error fetching countries' });
  }
}
