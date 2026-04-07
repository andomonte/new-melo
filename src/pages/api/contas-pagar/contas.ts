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
    const { busca, search, centro_custo } = req.query;
    const termoBusca = (busca || search) as string;
    const centroCustoId = centro_custo as string;
    const pool = getPgPool();

    let query = `
      SELECT 
        cf.cof_id,
        cf.cof_descricao,
        cf.cof_operacional,
        cc.cec_descricao as centro_custo_descricao,
        gcc.gcc_descricao as grupo_centro_custo_descricao
      FROM cad_conta_financeira cf
      LEFT JOIN cad_centro_custo cc ON cf.cof_cec_id = cc.cec_id
      LEFT JOIN cad_grupo_centro_custo gcc ON cc.cec_gcc_id = gcc.gcc_id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;
    
    // Filtro por centro de custo (se fornecido)
    if (centroCustoId && typeof centroCustoId === 'string') {
      conditions.push(`cf.cof_cec_id = $${paramIndex}`);
      params.push(centroCustoId);
      paramIndex++;
    }
    
    // Filtro por busca (texto ou número)
    if (termoBusca && typeof termoBusca === 'string') {
      // Verifica se a busca é numérica (código)
      const isNumeric = /^\d+$/.test(termoBusca.trim());
      
      if (isNumeric) {
        // Se for número, busca exata no ID ou parcial na descrição
        conditions.push(`(CAST(cf.cof_id AS TEXT) = $${paramIndex} OR cf.cof_descricao ILIKE $${paramIndex + 1})`);
        params.push(termoBusca.trim(), `%${termoBusca}%`);
        paramIndex += 2;
      } else {
        // Se for texto, busca apenas na descrição
        conditions.push(`cf.cof_descricao ILIKE $${paramIndex}`);
        params.push(`%${termoBusca}%`);
        paramIndex++;
      }
    }
    
    // Adicionar WHERE se houver condições
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY cf.cof_id LIMIT 50`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      contas: result.rows.map(row => {
        const descricaoUpper = (row.cof_descricao || '').toUpperCase();
        const ehInternacional = descricaoUpper.includes('INTERNACIONAL') ||
                               descricaoUpper.includes('IMPORT') ||
                               descricaoUpper.includes('USD') ||
                               descricaoUpper.includes('DOLAR') ||
                               descricaoUpper.includes('EXTERIOR');
        
        return {
          value: row.cof_id.toString(),
          cof_id: row.cof_id,
          cof_descricao: row.cof_descricao,
          cof_operacional: row.cof_operacional,
          centro_custo_descricao: row.centro_custo_descricao,
          grupo_centro_custo_descricao: row.grupo_centro_custo_descricao,
          eh_internacional: ehInternacional,
          label: `${row.cof_id} - ${row.cof_descricao}${row.centro_custo_descricao ? ` (${row.centro_custo_descricao})` : ''}`
        };
      })
    });

  } catch (error: any) {
    console.error('Erro ao buscar contas:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar contas',
      detalhes: error.message
    });
  }
}
