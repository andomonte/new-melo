import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface Comprador {
  codcomprador: string;
  nome: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Comprador[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query<Comprador>(`
      SELECT codcomprador, nome 
      FROM db_manaus.dbcompradores 
      ORDER BY nome
    `);
    
    client.release();
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar compradores:', err);
    res.status(500).json({ error: 'Falha ao buscar compradores.' });
  }
}