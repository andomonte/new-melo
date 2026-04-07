// API para atualização de status de requisições usando workflow
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { RequisitionWorkflow } from '@/lib/compras/workflow';
import { RequisitionStatus, UpdateStatusPayload } from '@/types/compras';

interface UpdateStatusRequest extends NextApiRequest {
  body: UpdateStatusPayload;
}

interface UpdateStatusResponse {
  success: boolean;
  message: string;
  data?: {
    id: number;
    versao: number;
    previousStatus: RequisitionStatus;
    newStatus: RequisitionStatus;
    updatedAt: string;
  };
  error?: string;
}

export default async function handler(
  req: UpdateStatusRequest,
  res: NextApiResponse<UpdateStatusResponse>
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const { id, versao, status, observacao, userId, userName } = req.body;

  // Validar dados obrigatórios
  if (!id || !versao || !status) {
    return res.status(400).json({
      success: false,
      message: 'Dados obrigatórios não informados: id, versao e status são obrigatórios'
    });
  }

  // Validar se o status é válido
  if (!Object.values(RequisitionStatus).includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status inválido'
    });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Buscar requisição atual
    const currentRequisitionResult = await client.query(
      'SELECT req_id, req_versao, req_status FROM cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [id, versao]
    );

    if (currentRequisitionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requisição não encontrada'
      });
    }

    const currentRequisition = currentRequisitionResult.rows[0];
    const currentStatus = currentRequisition.req_status as RequisitionStatus;

    // Verificar se o status já é o desejado
    if (currentStatus === status) {
      return res.status(400).json({
        success: false,
        message: 'A requisição já está no status solicitado'
      });
    }

    // TODO: Implementar sistema de permissões real
    // Por enquanto, simulamos permissões básicas
    const userPermissions = ['compra.criar', 'compra.editar', 'compra.aprovar', 'compra.gerenciar'];

    // Validar transição usando o workflow
    const validation = RequisitionWorkflow.validateStatusChange(
      currentStatus,
      status,
      userPermissions
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason || 'Transição de status inválida'
      });
    }

    // Iniciar transação
    await client.query('BEGIN');

    try {
      // Atualizar status da requisição
      const updateResult = await client.query(
        `UPDATE cmp_requisicao 
         SET req_status = $1, req_observacao = COALESCE($2, req_observacao), req_codusr = $3
         WHERE req_id = $4 AND req_versao = $5
         RETURNING req_id, req_versao, req_status`,
        [status, observacao, userId || 'SYSTEM', id, versao]
      );

      if (updateResult.rows.length === 0) {
        throw new Error('Falha ao atualizar requisição');
      }

      // Criar registro de histórico de mudança de status
      const historyRecord = RequisitionWorkflow.createStatusChangeRecord(
        id,
        versao,
        currentStatus,
        status,
        {
          userId: userId || 'SYSTEM',
          userName: userName || 'Sistema',
          reason: getStatusChangeReason(currentStatus, status),
          comments: observacao
        }
      );

      // Salvar histórico (assumindo que existe uma tabela para isso)
      try {
        await client.query(
          `INSERT INTO cmp_requisicao_historico 
           (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            historyRecord.requisitionId,
            historyRecord.requisitionVersion,
            historyRecord.previousStatus,
            historyRecord.newStatus,
            historyRecord.userId,
            historyRecord.userName,
            historyRecord.reason,
            historyRecord.comments,
            historyRecord.timestamp
          ]
        );
      } catch (historyError) {
        // Log do erro mas não falha a transação principal
        console.warn('Falha ao salvar histórico:', historyError);
      }

      // Se a requisição foi aprovada, gerar ordem de compra automaticamente
      if (status === RequisitionStatus.APPROVED) {
        try {
          const orderResult = await generateOrderIfNeeded(client, id, versao);
          if (orderResult.created) {
            console.log(`Ordem de compra ${orderResult.orderId} gerada automaticamente para requisição ${id}/${versao}`);
          }
        } catch (orderError) {
          console.warn('Falha ao gerar ordem de compra:', orderError);
          // Não falha a transação principal, mas registra o erro
        }
      }

      // Confirmar transação
      await client.query('COMMIT');

      const updatedRequisition = updateResult.rows[0];
      
      res.status(200).json({
        success: true,
        message: getSuccessMessage(currentStatus, status),
        data: {
          id: updatedRequisition.req_id,
          versao: updatedRequisition.req_versao,
          previousStatus: currentStatus,
          newStatus: status,
          updatedAt: new Date().toISOString()
        }
      });

    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    }

  } catch (error) {
    console.error('Erro ao atualizar status da requisição:', error);
    
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
 * Gera ordem de compra se necessário
 */
async function generateOrderIfNeeded(client: any, reqId: number, reqVersao: number): Promise<{ created: boolean; orderId?: number }> {
  // Verificar se já existe ordem de compra para esta requisição
  const existingOrderResult = await client.query(
    'SELECT orc_id FROM cmp_ordem_compra WHERE req_id = $1 AND req_versao = $2',
    [reqId, reqVersao]
  );

  if (existingOrderResult.rows.length > 0) {
    console.log('Ordem de compra já existe para esta requisição');
    return { created: false };
  }

  // Verificar se a requisição tem itens
  const itemsResult = await client.query(
    'SELECT COUNT(*) as item_count, SUM(preco_total) as valor_total FROM cmp_it_requisicao WHERE req_id = $1 AND req_versao = $2',
    [reqId, reqVersao]
  );

  const itemCount = parseInt(itemsResult.rows[0]?.item_count || '0');
  const valorTotal = parseFloat(itemsResult.rows[0]?.valor_total || '0');

  if (itemCount === 0) {
    console.warn('Não é possível gerar ordem de compra: requisição não possui itens');
    return { created: false };
  }

  // Gerar próximo ID da ordem de compra
  const maxOrderResult = await client.query(
    'SELECT COALESCE(MAX(orc_id), 0) + 1 as next_id FROM cmp_ordem_compra'
  );
  const nextOrderId = maxOrderResult.rows[0].next_id;

  // Criar ordem de compra com valor total calculado
  await client.query(
    `INSERT INTO cmp_ordem_compra
     (orc_id, req_id, req_versao, orc_data, orc_status, orc_observacao, orc_valor_total, created_at, updated_at)
     VALUES ($1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      nextOrderId,
      reqId,
      reqVersao,
      'P', // Ordem pendente
      `Ordem de compra gerada automaticamente pela aprovação da requisição. Total de ${itemCount} item(ns).`,
      valorTotal
    ]
  );

  return { created: true, orderId: nextOrderId };
}

/**
 * Obtém razão da mudança de status
 */
function getStatusChangeReason(from: RequisitionStatus, to: RequisitionStatus): string {
  switch (to) {
    case RequisitionStatus.SUBMITTED:
      return 'Requisição submetida para aprovação';
    case RequisitionStatus.APPROVED:
      return 'Requisição aprovada';
    case RequisitionStatus.REJECTED:
      return 'Requisição rejeitada';
    case RequisitionStatus.CANCELLED:
      return 'Requisição cancelada';
    case RequisitionStatus.DRAFT:
      return 'Requisição reaberta para edição';
    default:
      return `Status alterado de ${from} para ${to}`;
  }
}

/**
 * Obtém mensagem de sucesso
 */
function getSuccessMessage(from: RequisitionStatus, to: RequisitionStatus): string {
  switch (to) {
    case RequisitionStatus.SUBMITTED:
      return 'Requisição submetida com sucesso';
    case RequisitionStatus.APPROVED:
      return 'Requisição aprovada com sucesso';
    case RequisitionStatus.REJECTED:
      return 'Requisição rejeitada';
    case RequisitionStatus.CANCELLED:
      return 'Requisição cancelada';
    case RequisitionStatus.DRAFT:
      return 'Requisição reaberta para edição';
    default:
      return 'Status atualizado com sucesso';
  }
}