import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    ordem_id,
    observacoes,
    status_pagamento
  } = req.body;

  if (!ordem_id || !observacoes) {
    return res.status(400).json({
      success: false,
      message: 'Dados obrigatórios: ordem_id, observacoes'
    });
  }

  const ordemId = Number(ordem_id);

  if (isNaN(ordemId)) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem deve ser um número válido'
    });
  }

  try {
    const client = await pool.connect();

    // Verificar se a ordem existe
    const checkResult = await client.query(
      'SELECT orc_id, orc_status FROM db_manaus.cmp_ordem_compra WHERE orc_id = $1',
      [ordemId]
    );

    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    // Atualizar status da ordem para 'R' (Rejeitado)
    const updateResult = await client.query(
      `UPDATE db_manaus.cmp_ordem_compra
       SET orc_status = 'R'
       WHERE orc_id = $1
       RETURNING orc_id, orc_status`,
      [ordemId]
    );

    client.release();

    const updatedOrder = updateResult.rows[0];

    console.log('DEBUG - Pagamento rejeitado:', {
      ordemId: updatedOrder.orc_id,
      novoStatus: updatedOrder.orc_status,
      observacoes: observacoes
    });

    res.status(200).json({
      success: true,
      message: 'Pagamento rejeitado com sucesso',
      data: {
        ordemId: updatedOrder.orc_id,
        status: updatedOrder.orc_status,
        observacoes: observacoes
      }
    });
  } catch (err) {
    console.error('Erro ao rejeitar pagamento:', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao rejeitar pagamento',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}