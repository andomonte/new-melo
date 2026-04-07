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
      SELECT cod_ccusto, descr, tipo
      FROM dbccusto
    `;
    
    const params: any[] = [];
    
    if (busca && typeof busca === 'string') {
      query += ` WHERE 
        cod_ccusto ILIKE $1 OR 
        descr ILIKE $1
      `;
      params.push(`%${busca}%`);
    }
    
    query += ` ORDER BY descr LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      centros: result.rows.map(row => ({
        value: row.cod_ccusto,
        cod_ccusto: row.cod_ccusto,
        descr: row.descr,
        tipo: row.tipo,
        label: `${row.cod_ccusto} - ${row.descr}`
      }))
    });

  } catch (error: any) {
    console.error('Erro ao buscar centros de custo:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar centros de custo',
      detalhes: error.message
    });
  }
}
