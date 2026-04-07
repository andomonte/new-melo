import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { parseCookies } from 'nookies';
import { gerarDetalhesEdicaoRequisicao } from '@/lib/compras/historicoHelper';
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PUT') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
    });
  }

  let client;
  try {
    const requisition = req.body;
    const isDuplicate = req.body.isDuplicate || false; // Flag para indicar duplicação

    // Validate required fields
    if (!requisition.id) {
      return res.status(400).json({
        success: false,
        message: 'ID da requisição é obrigatório',
      });
    }

    // Obter informações do usuário do body ou dos cookies (fallback)
    const cookies = parseCookies({ req });
    const userName = req.body.userName || cookies.userName || 'Sistema';
    const userId = req.body.userId || cookies.userId || 'system';

    client = await pool.connect();

    // Buscar valores anteriores completos da requisição
    const previousQuery = `
      SELECT
        req_status,
        req_cod_credor,
        req_codcomprador,
        req_unm_id_entrega,
        req_unm_id_destino,
        req_previsao_chegada,
        req_cond_pagto,
        req_observacao
      FROM cmp_requisicao
      WHERE req_id = $1
    `;
    const previousResult = await client.query(previousQuery, [requisition.id]);

    if (previousResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requisição não encontrada',
      });
    }

    const previousData = previousResult.rows[0];
    const previousStatus = previousData.req_status;

    // Construir UPDATE dinamicamente - só atualiza campos que foram enviados
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (requisition.tipo !== undefined) {
      fieldsToUpdate.push(`req_tipo = $${paramIndex++}`);
      values.push(requisition.tipo);
    }
    if (requisition.fornecedorCodigo !== undefined) {
      fieldsToUpdate.push(`req_cod_credor = $${paramIndex++}`);
      values.push(requisition.fornecedorCodigo);
    }
    if (requisition.compradorCodigo !== undefined) {
      fieldsToUpdate.push(`req_codcomprador = $${paramIndex++}`);
      values.push(requisition.compradorCodigo);
    }
    if (requisition.localEntrega !== undefined) {
      fieldsToUpdate.push(`req_unm_id_entrega = $${paramIndex++}`);
      values.push(requisition.localEntrega);
    }
    if (requisition.destino !== undefined) {
      fieldsToUpdate.push(`req_unm_id_destino = $${paramIndex++}`);
      values.push(requisition.destino);
    }
    if (requisition.previsaoChegada !== undefined) {
      fieldsToUpdate.push(`req_previsao_chegada = $${paramIndex++}`);
      values.push(requisition.previsaoChegada);
    }
    if (requisition.condicoesPagamento !== undefined) {
      fieldsToUpdate.push(`req_cond_pagto = $${paramIndex++}`);
      values.push(requisition.condicoesPagamento);
    }
    if (requisition.observacao !== undefined) {
      fieldsToUpdate.push(`req_observacao = $${paramIndex++}`);
      values.push(requisition.observacao);
    }

    // Se não há campos para atualizar, retornar sucesso sem fazer query
    if (fieldsToUpdate.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nenhuma alteração detectada',
        rowsAffected: 0,
      });
    }

    // Adicionar WHERE req_id
    values.push(requisition.id);

    const updateQuery = `
      UPDATE cmp_requisicao
      SET ${fieldsToUpdate.join(', ')}
      WHERE req_id = $${paramIndex}
    `;

    const result = await client.query(updateQuery, values);

    // Track changes for detailed history
    const camposAlterados: any = {};

    if (requisition.fornecedorCodigo && requisition.fornecedorCodigo !== previousData.req_cod_credor) {
      camposAlterados.fornecedor = {
        anterior: previousData.req_cod_credor || '',
        novo: requisition.fornecedorCodigo
      };
    }

    if (requisition.compradorCodigo && requisition.compradorCodigo !== previousData.req_codcomprador) {
      camposAlterados.comprador = {
        anterior: previousData.req_codcomprador || '',
        novo: requisition.compradorCodigo
      };
    }

    if (requisition.localEntrega !== undefined && requisition.localEntrega !== previousData.req_unm_id_entrega) {
      camposAlterados.local_entrega = {
        anterior: previousData.req_unm_id_entrega || 0,
        novo: requisition.localEntrega
      };
    }

    if (requisition.destino !== undefined && requisition.destino !== previousData.req_unm_id_destino) {
      camposAlterados.destino = {
        anterior: previousData.req_unm_id_destino || 0,
        novo: requisition.destino
      };
    }

    if (requisition.previsaoChegada && requisition.previsaoChegada !== previousData.req_previsao_chegada) {
      camposAlterados.previsao_chegada = {
        anterior: previousData.req_previsao_chegada || '',
        novo: requisition.previsaoChegada
      };
    }

    if (requisition.condicoesPagamento && requisition.condicoesPagamento !== previousData.req_cond_pagto) {
      camposAlterados.condicoes_pagamento = {
        anterior: previousData.req_cond_pagto || '',
        novo: requisition.condicoesPagamento
      };
    }

    if (requisition.observacao !== undefined && requisition.observacao !== previousData.req_observacao) {
      camposAlterados.observacao = {
        anterior: previousData.req_observacao || '',
        novo: requisition.observacao || ''
      };
    }

    // Generate detailed history comment
    let comments: string;
    const reason = isDuplicate ? 'DUPLICACAO' : 'EDICAO';

    if (isDuplicate) {
      comments = 'Requisição duplicada através do sistema';
    } else if (Object.keys(camposAlterados).length > 0) {
      // Generate structured comment with changes
      comments = gerarDetalhesEdicaoRequisicao(camposAlterados);
    } else {
      // No changes detected
      comments = 'Requisição editada através do sistema (sem alterações detectadas)';
    }

    // Registrar no histórico
    const historicoQuery = `
      INSERT INTO cmp_requisicao_historico
        (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await client.query(historicoQuery, [
      requisition.id,
      1, // versão sempre 1 por enquanto
      previousStatus,
      previousStatus, // Status não muda na edição
      userId,
      userName,
      reason,
      comments,
    ]);

    res.status(200).json({
      success: true,
      message: 'Requisição atualizada com sucesso',
      rowsAffected: result.rowCount,
    });
  } catch (error) {
    console.error('Error updating requisition:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : undefined,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
