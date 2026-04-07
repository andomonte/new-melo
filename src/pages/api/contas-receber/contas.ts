import { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

const pool = getPgPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  try {
    const { search } = req.query;

    let whereClause = '';
    const params: any[] = [];

    // Filtro de busca por código ou descrição
    if (search) {
      whereClause = `WHERE CAST(cf.cof_id AS TEXT) LIKE $1 OR UPPER(cf.cof_descricao) LIKE UPPER($2)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const query = `
      SELECT 
        cf.cof_id,
        cf.cof_descricao,
        cc.cec_descricao as centro_custo_descricao,
        gcc.gcc_descricao as grupo_centro_custo_descricao
      FROM db_manaus.cad_conta_financeira cf
      LEFT JOIN db_manaus.cad_centro_custo cc ON cc.cec_id = cf.cof_cec_id
      LEFT JOIN db_manaus.cad_grupo_centro_custo gcc ON gcc.gcc_id = cc.cec_gcc_id
      ${whereClause}
      ORDER BY cf.cof_id
      LIMIT 100
    `;

    const result = await pool.query(query, params);

    const contas = result.rows.map(row => ({
      id: row.cof_id,
      descricao: row.cof_descricao,
      centro_custo: row.centro_custo_descricao,
      grupo_centro_custo: row.grupo_centro_custo_descricao,
      label: `${row.cof_id} - ${row.cof_descricao}${row.centro_custo_descricao ? ` (${row.centro_custo_descricao})` : ''}`,
    }));

    return res.status(200).json({ contas });

  } catch (error) {
    console.error('Erro ao buscar contas financeiras:', error);
    return res.status(500).json({
      erro: 'Erro interno do servidor',
      detalhes: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
