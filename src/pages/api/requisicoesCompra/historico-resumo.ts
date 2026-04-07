import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface HistoricoResumo {
  req_id: number;
  req_versao: number;
  req_numero: string;
  fornecedor_nome: string;
  comprador_nome: string;
  status_atual: string;
  status_label: string;
  total_mudancas: number;
  ultima_mudanca: string;
  data_criacao: string;
}

interface HistoricoResumoResponse {
  success: boolean;
  data?: HistoricoResumo[];
  message?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HistoricoResumoResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const { limit = '50', page = '1' } = req.query;
  const pageSize = parseInt(limit as string);
  const pageNumber = parseInt(page as string);
  const offset = (pageNumber - 1) * pageSize;

  const pool = getPgPool('manaus');
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Query complexa que une requisições com seu histórico
    const query = `
      WITH historico_resumo AS (
        SELECT 
          r.req_id,
          r.req_versao,
          COALESCE(r.req_numero, CONCAT('REQ-', r.req_id)) as req_numero,
          COALESCE(f.nome, r.fornecedor_nome, 'Fornecedor não informado') as fornecedor_nome,
          COALESCE(c.nome, r.comprador_nome, 'Comprador não informado') as comprador_nome,
          r.req_status as status_atual,
          CASE r.req_status
            WHEN 'P' THEN 'Pendente'
            WHEN 'S' THEN 'Submetida'
            WHEN 'A' THEN 'Aprovada'
            WHEN 'R' THEN 'Rejeitada'
            WHEN 'C' THEN 'Cancelada'
            ELSE COALESCE(r.req_status, 'Desconhecido')
          END as status_label,
          COALESCE(h.total_mudancas, 0) as total_mudancas,
          COALESCE(h.ultima_mudanca, r.req_data_criacao, NOW()) as ultima_mudanca,
          COALESCE(r.req_data_criacao, NOW()) as data_criacao
        FROM db_manaus.cmp_requisicao r
        LEFT JOIN (
          SELECT 
            req_id,
            req_versao,
            COUNT(*) as total_mudancas,
            MAX(created_at) as ultima_mudanca
          FROM db_manaus.cmp_requisicao_historico
          GROUP BY req_id, req_versao
        ) h ON r.req_id = h.req_id AND r.req_versao = h.req_versao
        LEFT JOIN db_manaus.fornecedores f ON r.fornecedor_id = f.id
        LEFT JOIN db_manaus.compradores c ON r.comprador_id = c.id
        WHERE r.req_id IS NOT NULL
      )
      SELECT *
      FROM historico_resumo
      ORDER BY ultima_mudanca DESC, req_id DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await client.query(query, [pageSize, offset]);

    console.log(`📊 Histórico resumo encontrado: ${result.rows.length} registros`);

    const historicos: HistoricoResumo[] = result.rows.map(row => ({
      req_id: row.req_id,
      req_versao: row.req_versao,
      req_numero: row.req_numero,
      fornecedor_nome: row.fornecedor_nome,
      comprador_nome: row.comprador_nome,
      status_atual: row.status_atual,
      status_label: row.status_label,
      total_mudancas: parseInt(row.total_mudancas || '0'),
      ultima_mudanca: row.ultima_mudanca,
      data_criacao: row.data_criacao
    }));

    res.status(200).json(serializeBigInt({
      success: true,
      data: historicos
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar histórico resumo:', error);
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