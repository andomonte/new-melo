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
    const { busca, search } = req.query;
    const termoBusca = (busca || search) as string;
    const pool = getPgPool();

    let query = `
      SELECT 
        c.cod_conta,
        c.cod_banco,
        c.nro_conta,
        c.oficial,
        c.digito,
        b.nome as banco_nome,
        b.cod_bc as banco_codigo
      FROM db_manaus.dbconta c
      LEFT JOIN db_manaus.dbbanco b ON b.cod_banco = c.cod_banco
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    // Filtro por busca (código ou nro_conta)
    if (termoBusca && typeof termoBusca === 'string') {
      const isNumeric = /^\d+$/.test(termoBusca.trim());
      
      if (isNumeric) {
        query += ` AND (c.cod_conta LIKE $${paramIndex} OR c.nro_conta ILIKE $${paramIndex + 1})`;
        params.push(`%${termoBusca.trim()}%`, `%${termoBusca}%`);
        paramIndex += 2;
      } else {
        query += ` AND c.nro_conta ILIKE $${paramIndex}`;
        params.push(`%${termoBusca}%`);
        paramIndex++;
      }
    }
    
    query += ` ORDER BY c.cod_conta LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      contas: result.rows.map(row => ({
        value: row.cod_conta,
        cod_conta: row.cod_conta,
        cod_banco: row.cod_banco,
        nro_conta: row.nro_conta,
        oficial: row.oficial,
        digito: row.digito,
        banco_nome: row.banco_nome,
        banco_codigo: row.banco_codigo,
        label: `${row.cod_conta} - ${row.nro_conta}${row.banco_nome ? ` | ${row.banco_nome}` : ''}`
      }))
    });

  } catch (error: any) {
    console.error('Erro ao buscar contas (dbconta):', error);
    return res.status(500).json({
      erro: 'Erro ao buscar contas',
      detalhes: error.message
    });
  }
}
