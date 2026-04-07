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
      SELECT cod_credor, nome, nome_fant, codpais
      FROM dbcredor
    `;
    
    const params: any[] = [];
    
    if (busca && typeof busca === 'string') {
      query += ` WHERE 
        cod_credor ILIKE $1 OR 
        nome ILIKE $1 OR 
        nome_fant ILIKE $1
      `;
      params.push(`%${busca}%`);
    }
    
    query += ` ORDER BY nome LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      fornecedores: result.rows.map(row => ({
        value: row.cod_credor,
        cod_credor: row.cod_credor,
        nome: row.nome,
        nome_fant: row.nome_fant,
        codpais: row.codpais,
        eh_internacional: row.codpais && row.codpais !== 1058,
        label: `${row.cod_credor} - ${row.nome}`
      }))
    });

  } catch (error: any) {
    console.error('Erro ao buscar fornecedores:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar fornecedores',
      detalhes: error.message
    });
  }
}
