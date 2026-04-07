import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ erro: 'ID do centro de custo é obrigatório' });
  }

  try {
    const pool = getPgPool();

    // Buscar a conta mais utilizada com este centro de custo
    // Ou buscar de uma tabela de configuração se existir
    const query = `
      SELECT 
        p.cod_conta,
        COUNT(*) as qtd_uso,
        co.nro_conta,
        co.cod_banco
      FROM db_manaus.dbpgto p
      LEFT JOIN db_manaus.dbconta co ON co.cod_conta = p.cod_conta
      WHERE p.cod_ccusto = $1
        AND p.cod_conta IS NOT NULL
      GROUP BY p.cod_conta, co.nro_conta, co.cod_banco
      ORDER BY qtd_uso DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length > 0) {
      return res.status(200).json({
        cod_conta: result.rows[0].cod_conta,
        nro_conta: result.rows[0].nro_conta,
        cod_banco: result.rows[0].cod_banco,
        qtd_uso: result.rows[0].qtd_uso
      });
    } else {
      // Não encontrou nenhuma conta associada
      return res.status(200).json({
        cod_conta: null,
        mensagem: 'Nenhuma conta encontrada para este centro de custo'
      });
    }

  } catch (error: any) {
    console.error('Erro ao buscar conta do centro de custo:', error);
    return res.status(500).json({
      erro: 'Erro ao buscar conta',
      detalhes: error.message
    });
  }
}
