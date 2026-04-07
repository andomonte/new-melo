import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface HistoricoItem {
  id: number;
  req_id: number;
  req_versao: number;
  previous_status: string;
  new_status: string;
  user_id: string;
  user_name: string;
  reason: string | null;
  comments: string | null;
  created_at: string;
  status_label_anterior: string;
  status_label_novo: string;
}

interface HistoricoResponse {
  success: boolean;
  data?: HistoricoItem[];
  message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HistoricoResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const { id, versao } = req.query;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'ID da requisição é obrigatório'
    });
  }

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Primeiro, tentar encontrar o req_id real pela requisição
    const reqLookupQuery = `
      SELECT req_id 
      FROM db_manaus.cmp_requisicao 
      WHERE req_id::text = $1 OR req_id_composto = $1
      LIMIT 1
    `;
    
    const reqLookupResult = await client.query(reqLookupQuery, [id]);
    
    let actualReqId = parseInt(id as string);
    if (reqLookupResult.rows.length > 0) {
      actualReqId = parseInt(reqLookupResult.rows[0].req_id);
      console.log(`🔍 Mapeamento ID: ${id} → ${actualReqId}`);
    } else {
      console.log(`⚠️ Requisição não encontrada para ID: ${id}`);
    }

    // Query para buscar histórico da requisição
    const query = `
      SELECT 
        h.id,
        h.req_id,
        h.req_versao,
        h.previous_status,
        h.new_status,
        h.user_id,
        h.user_name,
        h.reason,
        h.comments,
        h.created_at,
        CASE 
          WHEN h.previous_status = '' THEN 'Criação'
          WHEN h.previous_status = 'P' THEN 'Pendente'
          WHEN h.previous_status = 'S' THEN 'Submetida'
          WHEN h.previous_status = 'A' THEN 'Aprovada'
          WHEN h.previous_status = 'R' THEN 'Rejeitada'
          WHEN h.previous_status = 'C' THEN 'Cancelada'
          ELSE h.previous_status
        END as status_label_anterior,
        CASE h.new_status
          WHEN 'P' THEN 'Pendente'
          WHEN 'S' THEN 'Submetida'
          WHEN 'A' THEN 'Aprovada'
          WHEN 'R' THEN 'Rejeitada'
          WHEN 'C' THEN 'Cancelada'
          ELSE h.new_status
        END as status_label_novo
      FROM db_manaus.cmp_requisicao_historico h
      WHERE h.req_id = $1 ${versao ? 'AND h.req_versao = $2' : ''}
      ORDER BY h.created_at DESC, h.id DESC
    `;

    const params = versao ? [actualReqId, parseInt(versao as string)] : [actualReqId];
    const result = await client.query(query, params);

    console.log(`📋 Histórico encontrado para requisição ${id}${versao ? `/${versao}` : ''}: ${result.rows.length} registros`);

    const historico: HistoricoItem[] = result.rows.map(row => ({
      id: row.id,
      req_id: row.req_id,
      req_versao: row.req_versao,
      previous_status: row.previous_status,
      new_status: row.new_status,
      user_id: row.user_id,
      user_name: row.user_name,
      reason: row.reason,
      comments: row.comments,
      created_at: row.created_at,
      status_label_anterior: row.status_label_anterior,
      status_label_novo: row.status_label_novo
    }));

    res.status(200).json(serializeBigInt({
      success: true,
      data: historico
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar histórico da requisição:', error);
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