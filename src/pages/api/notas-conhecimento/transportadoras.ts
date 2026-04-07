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
      SELECT cod_transp, nome, cnpj
      FROM db_manaus.dbtransp
    `;
    
    const params: any[] = [];
    
    if (busca && typeof busca === 'string') {
      query += ` WHERE 
        cod_transp ILIKE $1 OR 
        nome ILIKE $1 OR
        cnpj ILIKE $1
      `;
      params.push(`%${busca}%`);
    }
    
    query += ` ORDER BY nome LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      transportadoras: result.rows.map(row => ({
        value: row.cod_transp,
        cod_transp: row.cod_transp,
        nome: row.nome,
        cnpj: row.cnpj,
        label: `${row.cod_transp} - ${row.nome}`
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
