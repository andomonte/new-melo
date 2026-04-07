// API para atualização de status de ordens de compra
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

interface UpdateOrderStatusRequest {
  status: string;
  observacao?: string;
  userId?: string;
}

interface UpdateOrderStatusResponse {
  success: boolean;
  message: string;
  data?: {
    orc_id: number;
    orc_status: string;
    updated_at: string;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UpdateOrderStatusResponse>
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { id } = req.query;
  const { status, observacao, userId }: UpdateOrderStatusRequest = req.body;

  // Validações
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem inválido'
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      message: 'Status é obrigatório'
    });
  }

  // Validar status permitidos
  const allowedStatuses = ['P', 'A', 'C', 'F']; // Pendente, Aprovada, Cancelada, Finalizada
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status inválido. Valores permitidos: P (Pendente), A (Aprovada), C (Cancelada), F (Finalizada)'
    });
  }

  let client;
  try {
    client = await pool.connect();

    // Verificar se a ordem existe
    const existingOrderResult = await client.query(
      'SELECT orc_id, orc_status FROM cmp_ordem_compra WHERE orc_id = $1',
      [parseInt(id as string)]
    );

    if (existingOrderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const currentOrder = existingOrderResult.rows[0];

    // Verificar se o status já é o desejado
    if (currentOrder.orc_status === status) {
      return res.status(400).json({
        success: false,
        message: 'A ordem já está no status solicitado'
      });
    }

    // Validar transições de status
    const isValidTransition = validateStatusTransition(currentOrder.orc_status, status);
    if (!isValidTransition.valid) {
      return res.status(400).json({
        success: false,
        message: isValidTransition.reason || 'Transição de status inválida'
      });
    }

    // Atualizar status
    const updateResult = await client.query(
      `UPDATE cmp_ordem_compra 
       SET orc_status = $1, orc_observacao = COALESCE($2, orc_observacao), updated_at = CURRENT_TIMESTAMP
       WHERE orc_id = $3
       RETURNING orc_id, orc_status, updated_at`,
      [status, observacao, parseInt(id as string)]
    );

    const updatedOrder = updateResult.rows[0];

    // Registrar histórico (opcional)
    try {
      await client.query(
        `INSERT INTO cmp_ordem_historico 
         (orc_id, previous_status, new_status, user_id, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          parseInt(id as string),
          currentOrder.orc_status,
          status,
          userId || 'SYSTEM',
          getStatusChangeReason(currentOrder.orc_status, status)
        ]
      );
    } catch (historyError) {
      // Não falha a operação se não conseguir salvar histórico
      console.warn('Falha ao salvar histórico da ordem:', historyError);
    }

    res.status(200).json({
      success: true,
      message: getSuccessMessage(currentOrder.orc_status, status),
      data: {
        orc_id: updatedOrder.orc_id,
        orc_status: updatedOrder.orc_status,
        updated_at: updatedOrder.updated_at
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar status da ordem:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Valida transições de status
 */
function validateStatusTransition(currentStatus: string, targetStatus: string): { valid: boolean; reason?: string } {
  const transitions: Record<string, string[]> = {
    'P': ['A', 'C'], // Pendente pode ir para Aprovada ou Cancelada
    'A': ['F', 'C'], // Aprovada pode ir para Finalizada ou Cancelada
    'C': [],         // Cancelada é final
    'F': []          // Finalizada é final
  };

  const allowedTransitions = transitions[currentStatus] || [];
  
  if (!allowedTransitions.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Não é possível alterar status de ${getStatusLabel(currentStatus)} para ${getStatusLabel(targetStatus)}`
    };
  }

  return { valid: true };
}

/**
 * Obtém label do status
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'P': 'Pendente',
    'A': 'Aprovada',
    'C': 'Cancelada',
    'F': 'Finalizada'
  };
  return labels[status] || 'Desconhecido';
}

/**
 * Obtém razão da mudança de status
 */
function getStatusChangeReason(from: string, to: string): string {
  switch (to) {
    case 'A':
      return 'Ordem de compra aprovada';
    case 'C':
      return 'Ordem de compra cancelada';
    case 'F':
      return 'Ordem de compra finalizada';
    default:
      return `Status alterado de ${getStatusLabel(from)} para ${getStatusLabel(to)}`;
  }
}

/**
 * Obtém mensagem de sucesso
 */
function getSuccessMessage(from: string, to: string): string {
  switch (to) {
    case 'A':
      return 'Ordem de compra aprovada com sucesso';
    case 'C':
      return 'Ordem de compra cancelada';
    case 'F':
      return 'Ordem de compra finalizada com sucesso';
    default:
      return 'Status da ordem atualizado com sucesso';
  }
}