import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pg';

/**
 * Lista as contas financeiras para o recebimento do Caixa (porte do modal
 * "Contas Financeiras" do SysCaixa — SP PLANO_DE_CONTAS.NAV_CONTA_FINANCEIRA).
 * Fonte: cad_conta_financeira (cof_id, cof_descricao) JOIN cad_centro_custo (cec_descricao).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT cf.cof_id, cf.cof_descricao, cf.cof_operacional,
              cc.cec_descricao AS centro_custo
         FROM cad_conta_financeira cf
         LEFT JOIN cad_centro_custo cc ON cc.cec_id = cf.cof_cec_id
        WHERE COALESCE(cf.status, 'ativo') = 'ativo'
        ORDER BY cf.cof_descricao`,
    );
    return res.status(200).json({ contas: r.rows });
  } catch (error: any) {
    console.error('Erro ao listar contas financeiras:', error);
    return res.status(500).json({ erro: 'Erro interno', detalhes: error.message });
  } finally {
    client.release();
  }
}
