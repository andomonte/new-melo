// src/pages/api/requisicoesCompra/actions/reject.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { getUserOrDefault } from '@/lib/authHelper';

interface RejectRequest {
  requisitionId: string;
  version: number;
  userId?: string;
  userName?: string;
  comments?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { requisitionId, version, userId, userName, comments } = req.body as RejectRequest;

  if (!requisitionId || !version) {
    return res.status(400).json({
      success: false,
      message: 'ID da requisição e versão são obrigatórios'
    });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  // Obter dados do usuário autenticado (prioriza body, depois helper)
  const helperUser = getUserOrDefault(req);
  const finalUserId = userId || helperUser.login_user_login;
  const finalUserName = userName || helperUser.login_user_name;
  console.log('🔍 Usuário capturado para histórico (reject):', { finalUserId, finalUserName });

  try {
    client = await pool.connect();
    
    // Verificar se a requisição existe e está em status que permite reprovação
    // Busca por req_id (formato completo ex: 12002010068) que é o que o frontend envia
    const checkResult = await client.query(
      'SELECT req_id, req_status FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [requisitionId.toString(), version]
    );
    
    if (checkResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ 
        success: false, 
        message: 'Requisição não encontrada' 
      });
    }
    
    const currentStatus = checkResult.rows[0].req_status;
    
    // Só pode reprovar se estiver submetida (S)
    if (currentStatus !== 'S') {
      client.release();
      return res.status(400).json({ 
        success: false, 
        message: `Não é possível reprovar requisição com status ${currentStatus}. Deve estar submetida.` 
      });
    }
    
    // Iniciar transação
    await client.query('BEGIN');

    // Atualizar status para Reprovada (R)
    const updateResult = await client.query(
      `UPDATE db_manaus.cmp_requisicao
       SET req_status = 'R'
       WHERE req_id = $1 AND req_versao = $2
       RETURNING req_id, req_versao, req_status`,
      [requisitionId.toString(), version]
    );

    // Registrar histórico da mudança
    try {
      await client.query(
        `INSERT INTO db_manaus.cmp_requisicao_historico 
         (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          checkResult.rows[0].req_id,
          version,
          currentStatus,
          'R',
          finalUserId,
          finalUserName,
          `Requisição rejeitada`,
          comments || `Rejeitada via interface por ${finalUserName}`
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
      message: 'Requisição reprovada com sucesso',
      data: updateResult.rows[0]
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Erro ao reprovar requisição:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor ao reprovar requisição',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}