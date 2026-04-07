// src/pages/api/requisicoesCompra/post/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { CreateRequisitionResponse, RequisitionStatus } from '@/types/compras';
import { parseCookies } from 'nookies';

// Interface para dados recebidos do frontend
interface RequestPayload {
  tipo: string;
  cod_fornecedor: string;
  nome_fornecedor: string;
  comprador: string;
  nome_comprador: string;
  entrega_em: string;
  destinado_para: string;
  previsao_chegada: string | null;
  condicoes_pagamento: string;
  observacao: string;
  req_status: string;
  isDuplicate?: boolean; // Flag para indicar duplicação
  userId?: string; // ID do usuário que está criando
  userName?: string; // Nome do usuário que está criando
}

// interface CreatedRequisition {
//   req_id: number;
//   req_versao: number;
//   req_id_composto: string;
//   req_status: string;
// }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateRequisitionResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const payload = req.body as RequestPayload;
  const isDuplicate = payload.isDuplicate || false;

  // Validar dados obrigatórios
  if (!payload.tipo || !payload.cod_fornecedor || !payload.comprador) {
    return res.status(400).json({
      success: false,
      message: 'Dados obrigatórios não informados: tipo, fornecedor e comprador são obrigatórios'
    });
  }

  // Validar status
  if (!Object.values(RequisitionStatus).includes(payload.req_status as RequisitionStatus)) {
    return res.status(400).json({
      success: false,
      message: 'Status inválido'
    });
  }

  // Obter informações do usuário do body ou dos cookies (fallback)
  const cookies = parseCookies({ req });
  const userName = payload.userName || cookies.userName || 'Sistema';
  const userId = payload.userId || cookies.userId || 'system';

  try {
    const client = await pool.connect();

    // Usar os códigos recebidos do formulário
    const compradorCodigo = payload.comprador; // Código do comprador vem do formulário
    const fornecedorCodigo = payload.cod_fornecedor; // Código do fornecedor vem do formulário

    console.log('DEBUG - Usando códigos do formulário:', { compradorCodigo, fornecedorCodigo });

    // Validar se o fornecedor existe (BUG-005 fix)
    const fornecedorCheck = await client.query(
      'SELECT cod_credor FROM db_manaus.dbcredor WHERE cod_credor = $1',
      [fornecedorCodigo]
    );
    if (fornecedorCheck.rows.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: `Fornecedor não encontrado: ${fornecedorCodigo}`
      });
    }

    // Validar se o comprador existe (BUG-005 fix)
    const compradorCheck = await client.query(
      'SELECT codcomprador FROM db_manaus.dbcompradores WHERE codcomprador = $1',
      [compradorCodigo]
    );
    if (compradorCheck.rows.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        message: `Comprador não encontrado: ${compradorCodigo}`
      });
    }

    // Gerar próximo ID sequencial
    const maxIdResult = await client.query(
      'SELECT COALESCE(MAX(req_id), 0) + 1 as next_id FROM cmp_requisicao'
    );
    const nextReqId = maxIdResult.rows[0].next_id;
    
    // Gerar req_id_composto - usar apenas os últimos dígitos para caber no campo VARCHAR(2)
    const reqIdComposto = nextReqId.toString().slice(-2).padStart(2, '0');
    
    console.log('DEBUG - Generated req_id:', nextReqId, 'req_id_composto:', reqIdComposto);
    
    // Inserir requisição com dados mapeados corretamente
    const insertResult = await client.query(
      `
      INSERT INTO cmp_requisicao
        (req_id, req_versao, req_id_composto, req_data, req_status, req_cond_pagto, req_observacao, req_tipo,
         req_cod_credor, req_codcomprador, req_unm_id_entrega, req_unm_id_destino, req_previsao_chegada, req_codusr)
      VALUES
        ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING req_id, req_versao, req_id_composto, req_status
      `,
      [
        nextReqId,
        1, // req_versao sempre começa em 1
        reqIdComposto,
        payload.req_status.substring(0, 1), // Limitar status a 1 char
        payload.condicoes_pagamento.substring(0, 50), // Limitar condições
        payload.observacao.substring(0, 200), // Limitar observação
        payload.tipo.substring(0, 2), // Limitar o tipo a 2 caracteres
        fornecedorCodigo, // Usar código validado do fornecedor
        compradorCodigo, // Usar código validado do comprador
        payload.entrega_em ? parseInt(payload.entrega_em) : null,
        payload.destinado_para ? parseInt(payload.destinado_para) : null,
        payload.previsao_chegada || null,
        'S' // Limitar código do usuário a 1 caractere
      ],
    );
    
    const createdRequisition = insertResult.rows[0];
    
    // Registrar histórico da criação
    try {
      const reason = isDuplicate ? 'DUPLICACAO' : 'CRIACAO';
      const comments = isDuplicate
        ? 'Requisição duplicada através do sistema'
        : `Requisição criada com status ${createdRequisition.req_status}`;

      await client.query(
        `INSERT INTO cmp_requisicao_historico
         (req_id, req_versao, previous_status, new_status, user_id, user_name, reason, comments)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          createdRequisition.req_id,
          createdRequisition.req_versao,
          '', // previous_status é vazio na criação
          createdRequisition.req_status,
          userId,
          userName,
          reason,
          comments
        ]
      );
      console.log('DEBUG - Histórico de criação registrado (isDuplicate:', isDuplicate, ')');
    } catch (historyError) {
      console.warn('Erro ao registrar histórico de criação:', historyError);
      // Não falha a criação da requisição se der erro no histórico
    }
    
    // Retornar com req_id_composto formatado para o frontend
    const responseData = {
      ...createdRequisition,
      req_id_composto: `REQ-${createdRequisition.req_id.toString().padStart(6, '0')}`
    };
    
    console.log('DEBUG - createdRequisition:', responseData);
    
    client.release();
    
    res.status(200).json({ 
      success: true,
      message: 'Requisição criada com sucesso',
      data: responseData
    });
  } catch (err) {
    console.error('Erro ao criar requisição:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor ao criar requisição',
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}
