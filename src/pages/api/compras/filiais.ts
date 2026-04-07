import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface Filial {
  unm_id: string;
  unm_nome: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Filial[] | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const client = await pool.connect();
    
    const result = await client.query<Filial>(`
      SELECT unm_id, unm_nome 
      FROM db_manaus.cad_unidade_melo 
      ORDER BY unm_nome
    `);
    
    client.release();
    
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar filiais:', err);
    res.status(500).json({ error: 'Falha ao buscar filiais.' });
  }
}