/**
 * API de Histórico de Ordem de Compra
 *
 * GET /api/ordens/[id]/historico - Busca histórico completo da ordem
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import {
  buscarHistoricoOrdem,
  HistoricoOrdemItem
} from '@/lib/compras/ordemHistoricoHelper';

interface HistoricoResponse {
  success: boolean;
  data?: HistoricoOrdemItem[];
  ordem?: {
    orc_id: number;
    req_id_composto: string;
    fornecedor: string;
    status: string;
    valor_total: number;
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HistoricoResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { id } = req.query;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      success: false,
      message: 'ID da ordem é obrigatório'
    });
  }

  const orcId = Number(id);
  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Buscar dados da ordem
    const ordemQuery = `
      SELECT
        o.orc_id,
        COALESCE(r.req_id_composto, o.orc_id::text) as req_id_composto,
        COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor,
        o.orc_status as status,
        COALESCE(o.orc_valor_total, 0) as valor_total
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor c
        ON r.req_cod_credor = c.cod_credor
      WHERE o.orc_id = $1
    `;

    const ordemResult = await client.query(ordemQuery, [orcId]);

    if (ordemResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ordem de compra não encontrada'
      });
    }

    const ordem = ordemResult.rows[0];

    // Buscar histórico
    const historico = await buscarHistoricoOrdem(client, orcId);

    console.log(`📋 Histórico da ordem ${orcId}: ${historico.length} registros`);

    res.status(200).json(serializeBigInt({
      success: true,
      data: historico,
      ordem: {
        orc_id: ordem.orc_id,
        req_id_composto: ordem.req_id_composto,
        fornecedor: ordem.fornecedor,
        status: ordem.status,
        valor_total: parseFloat(ordem.valor_total)
      }
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar histórico da ordem:', error);
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
