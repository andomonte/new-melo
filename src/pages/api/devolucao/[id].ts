/**
 * GET /api/devolucao/[id]
 * Retorna uma devolução com seus itens
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'ID inválido' });
  }

  const devolucaoId = parseInt(id, 10);
  if (isNaN(devolucaoId)) {
    return res.status(400).json({ message: 'ID deve ser numérico' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';

  const pool = getPgPool(filial);

  try {
    const devolucaoResult = await pool.query(
      `SELECT
        id, entrada_id, numero_entrada, fornecedor, nfe_numero, nfe_serie,
        status, total_itens, qtd_total_devolucao, observacao,
        created_by, created_at, updated_at
      FROM devolucoes
      WHERE id = $1`,
      [devolucaoId],
    );

    if (devolucaoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Devolução não encontrada' });
    }

    const itensResult = await pool.query(
      `SELECT
        id, entrada_item_id, produto_cod, produto_nome, unidade,
        qtd_esperada, qtd_recebida, qtd_devolucao, motivo, observacao,
        created_at
      FROM devolucao_itens
      WHERE devolucao_id = $1
      ORDER BY id`,
      [devolucaoId],
    );

    return res.status(200).json({
      success: true,
      data: {
        ...devolucaoResult.rows[0],
        itens: itensResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Erro ao buscar devolução:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao buscar devolução',
    });
  }
}
