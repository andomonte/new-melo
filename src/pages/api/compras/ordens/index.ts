// API para gerenciamento de ordens de compra
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { RequisitionStatus } from '@/types/compras';

interface OrdemCompra {
  orc_id: number;
  req_id: number;
  req_versao: number;
  orc_data: string;
  orc_status: string;
  orc_observacao?: string;
  orc_valor_total?: number;
  created_at?: string;
  updated_at?: string;
}

interface CreateOrderRequest {
  req_id: number;
  req_versao: number;
  observacao?: string;
}

interface CreateOrderResponse {
  success: boolean;
  message: string;
  data?: OrdemCompra;
  error?: string;
}

interface ListOrdersResponse {
  success: boolean;
  data: OrdemCompra[];
  total: number;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateOrderResponse | ListOrdersResponse>
) {
  switch (req.method) {
    case 'GET':
      return handleGetOrders(req, res);
    case 'POST':
      return handleCreateOrder(req, res);
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} Not Allowed`
      });
  }
}

/**
 * Lista ordens de compra com filtros opcionais
 */
async function handleGetOrders(
  req: NextApiRequest,
  res: NextApiResponse<ListOrdersResponse>
) {
  const { req_id, status, page = '1', limit = '50' } = req.query;
  
  let client;
  try {
    client = await pool.connect();
    
    // Construir query com filtros - usando estrutura real do banco
    await client.query('SET search_path TO db_manaus');

    let query = `
      SELECT
        o.orc_id,
        o.orc_req_id,
        o.orc_req_versao,
        o.orc_data,
        o.orc_status,
        r.req_id_composto,
        r.req_status,
        r.req_observacao,
        r.req_codcomprador,
        r.req_cod_credor,
        r.req_previsao_chegada,
        r.req_cond_pagto,
        COALESCE(f.nome, f.nome_fant, 'SEM FORNECEDOR') as fornecedor_nome,
        COALESCE(c.nome, 'SEM COMPRADOR') as comprador_nome,
        (SELECT SUM(ri.itr_pr_unitario * ri.itr_quantidade)
         FROM cmp_it_requisicao ri
         WHERE ri.itr_req_id = r.req_id AND ri.itr_req_versao = r.req_versao) as valor_total
      FROM cmp_ordem_compra o
      LEFT JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (req_id) {
      query += ` AND o.orc_req_id = $${paramIndex}`;
      params.push(parseInt(req_id as string));
      paramIndex++;
    }
    
    if (status) {
      query += ` AND o.orc_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Ordenação e paginação
    query += ` ORDER BY o.orc_data DESC, o.orc_id DESC`;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);
    
    const result = await client.query(query, params);
    
    // Contar total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM cmp_ordem_compra o
      LEFT JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      WHERE 1=1
    `;
    
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    if (req_id) {
      countQuery += ` AND o.orc_req_id = $${countParamIndex}`;
      countParams.push(parseInt(req_id as string));
      countParamIndex++;
    }
    
    if (status) {
      countQuery += ` AND o.orc_status = $${countParamIndex}`;
      countParams.push(status);
    }
    
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.status(200).json({
      success: true,
      data: result.rows,
      total
    });
    
  } catch (error) {
    console.error('Erro ao buscar ordens de compra:', error);
    res.status(500).json({
      success: false,
      data: [],
      total: 0,
      message: 'Erro interno do servidor'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * Cria uma nova ordem de compra a partir de uma requisição aprovada
 */
async function handleCreateOrder(
  req: NextApiRequest,
  res: NextApiResponse<CreateOrderResponse>
) {
  const { req_id, req_versao, observacao }: CreateOrderRequest = req.body;
  
  // Validações
  if (!req_id || !req_versao) {
    return res.status(400).json({
      success: false,
      message: 'req_id e req_versao são obrigatórios'
    });
  }
  
  let client;
  try {
    client = await pool.connect();
    
    // Iniciar transação
    await client.query('BEGIN');
    
    // Verificar se a requisição existe e está aprovada
    await client.query('SET search_path TO db_manaus');
    const requisitionResult = await client.query(
      'SELECT req_id, req_versao, req_status FROM db_manaus.cmp_requisicao WHERE req_id = $1 AND req_versao = $2',
      [req_id, req_versao]
    );
    
    if (requisitionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Requisição não encontrada'
      });
    }
    
    const requisition = requisitionResult.rows[0];
    
    if (requisition.req_status !== RequisitionStatus.APPROVED) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Apenas requisições aprovadas podem gerar ordens de compra'
      });
    }
    
    // Verificar se já existe ordem de compra para esta requisição
    const existingOrderResult = await client.query(
      'SELECT orc_id FROM db_manaus.cmp_ordem_compra WHERE orc_req_id = $1 AND orc_req_versao = $2',
      [req_id, req_versao]
    );
    
    if (existingOrderResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Já existe uma ordem de compra para esta requisição'
      });
    }
    
    // Calcular valor total dos itens
    const itemsResult = await client.query(
      'SELECT SUM(itr_quantidade * itr_pr_unitario) as valor_total FROM db_manaus.cmp_it_requisicao WHERE itr_req_id = $1 AND itr_req_versao = $2',
      [req_id, req_versao]
    );
    
    const valorTotal = itemsResult.rows[0]?.valor_total || 0;
    
    // Gerar próximo ID da ordem
    const maxIdResult = await client.query(
      'SELECT COALESCE(MAX(orc_id), 0) + 1 as next_id FROM db_manaus.cmp_ordem_compra'
    );
    const nextOrderId = maxIdResult.rows[0].next_id;
    
    // Criar ordem de compra
    const insertResult = await client.query(
      `INSERT INTO db_manaus.cmp_ordem_compra
       (orc_id, orc_req_id, orc_req_versao, orc_data, orc_status, orc_observacao, orc_valor_total, created_at, updated_at)
       VALUES ($1, $2, $3, (CURRENT_TIMESTAMP AT TIME ZONE 'America/Manaus')::date, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        nextOrderId,
        req_id,
        req_versao,
        'P', // Status: Pendente
        observacao || 'Ordem de compra gerada automaticamente',
        valorTotal
      ]
    );
    
    const newOrder = insertResult.rows[0];
    
    // Confirmar transação
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Ordem de compra criada com sucesso',
      data: newOrder
    });
    
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    
    console.error('Erro ao criar ordem de compra:', error);
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