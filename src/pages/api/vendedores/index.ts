import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  const pool = getPgPool(filial);

  try {
    // Assuming 'status' column exists and 'A' means Active. 
    // Adjust query if column name or value differs.
    // Based on inspection, 'status' '0' has 282 records, likely Active.
    const query = `
      SELECT codvend as id, nome 
      FROM dbvend 
      WHERE status = '0' OR status IS NULL
      ORDER BY nome ASC
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query);
      res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching sellers:', error);
    res.status(500).json({ error: 'Error fetching sellers' });
  }
}
