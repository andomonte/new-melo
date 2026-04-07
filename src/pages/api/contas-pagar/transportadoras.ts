import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const { busca } = req.query;
    const pool = getPgPool();

    let query = `
      SELECT codtransp, nome, nomefant
      FROM dbtransp
    `;
    
    const params: any[] = [];
    
    if (busca && typeof busca === 'string') {
      query += ` WHERE 
        codtransp ILIKE $1 OR 
        nome ILIKE $1 OR 
        nomefant ILIKE $1
      `;
      params.push(`%${busca}%`);
    }
    
    query += ` ORDER BY nome LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      transportadoras: result.rows.map(row => ({
        value: row.codtransp,
        codtransp: row.codtransp,
        nome: row.nome,
        nomefant: row.nomefant,
        label: `${row.codtransp} - ${row.nome}`
      }))
    });

  } catch (error: any) {
    console.error('Erro ao buscar transportadoras:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar transportadoras',
      detalhes: error.message
    });
  }
}
