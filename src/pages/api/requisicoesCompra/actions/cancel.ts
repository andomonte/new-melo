import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { getUserOrDefault } from '@/lib/authHelper';

interface CancelRequestBody {
  requisitionId: string;
  version: number;
  userId?: string;
  userName?: string;
  comments?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    const { requisitionId, version, userId, userName, comments }: CancelRequestBody = req.body;

    // Obter dados do usuário autenticado (prioriza body, depois helper)
    const helperUser = getUserOrDefault(req);
    const finalUserId = userId || helperUser.login_user_login;
    const finalUserName = userName || helperUser.login_user_name;

    // Validate required fields
    if (!requisitionId || !version) {
      return res.status(400).json({
        success: false,
        message: 'requisitionId and version are required'
      });
    }

    client = await pool.connect();

    // Check if requisition exists and get current status
    // Busca por req_id (formato completo ex: 12002010068) que é o que o frontend envia
    const checkQuery = `
      SELECT req_id, req_status, req_versao
      FROM db_manaus.cmp_requisicao
      WHERE req_id = $1 AND req_versao = $2
    `;

    const existingResult = await client.query(checkQuery, [requisitionId.toString(), version]);

    if (existingResult.rows.length === 0) {
      if (client) client.release();
      return res.status(404).json({
        success: false,
        message: 'Requisição não encontrada'
      });
    }

    const currentRecord = existingResult.rows[0];
    const currentStatus = currentRecord.req_status;

    // Validate that requisition can be cancelled
    if (!['P', 'S'].includes(currentStatus)) {
      if (client) client.release();
      return res.status(400).json({
        success: false,
        message: 'Apenas requisições Pendentes ou Submetidas podem ser canceladas'
      });
    }

    // Iniciar transação
    await client.query('BEGIN');

    // Update requisition status to cancelled
    const updateQuery = `
      UPDATE db_manaus.cmp_requisicao
      SET req_status = 'C'
      WHERE req_id = $1 AND req_versao = $2
      RETURNING req_id, req_versao, req_status
    `;

    await client.query(updateQuery, [requisitionId.toString(), version]);

    // Registrar histórico da mudança
    try {
      const cancelComment = comments || 'Cancelamento via interface';
      await client.query(
        `INSERT INTO db_manaus.cmp_requisicao_historico
         (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          currentRecord.req_id,
          version,
          currentStatus,
          'C',
          finalUserId,
          finalUserName,
          `Requisição cancelada`,
          cancelComment
        ]
      );
    } catch (historyError) {
      console.warn('Erro ao registrar histórico:', historyError);
      // Não falha a transação principal
    }

    // Commit da transação
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Requisição cancelada com sucesso'
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error cancelling requisition:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}