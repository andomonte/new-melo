import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { search = '', page = '1', perPage = '25' } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limit = parseInt(perPage as string) || 25;
  const offset = (pageNum - 1) * limit;

  try {
    const client = await pool.connect();
    
    // Construir query com filtro de busca
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause = `
        WHERE (
          CAST(o.orc_id AS TEXT) ILIKE $1 OR
          CAST(o.orc_req_id AS TEXT) ILIKE $1 OR
          r.req_id_composto ILIKE $1 OR
          f.nome ILIKE $1 OR
          CAST(f.cod_credor AS TEXT) ILIKE $1 OR
          c.nome ILIKE $1 OR
          CAST(c.codcomprador AS TEXT) ILIKE $1 OR
          o.orc_observacao ILIKE $1 OR
          TO_CHAR(o.orc_data, 'DD/MM/YYYY') ILIKE $1 OR
          TO_CHAR(o.orc_previsao_chegada, 'DD/MM/YYYY') ILIKE $1 OR
          TO_CHAR(r.req_previsao_chegada, 'DD/MM/YYYY') ILIKE $1
        )
      `;
      params.push(`%${search}%`);
    }
    
    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.cmp_ordem_compra o
      LEFT JOIN db_manaus.cmp_requisicao r 
        ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      LEFT JOIN db_manaus.dbcredor f 
        ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c 
        ON r.req_codcomprador = c.codcomprador
      WHERE 1=1
      ${whereClause.replace('WHERE', 'AND')}
    `;
    
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total) || 0;
    
    // Buscar ordens de compra com TODOS os dados necessários
    const ordensQuery = `
      SELECT
        o.orc_id,
        o.orc_req_id,
        o.orc_req_versao,
        o.orc_data,
        o.orc_status,

        -- Dados de pagamento
        o.orc_pagamento_configurado,
        o.orc_banco,
        o.orc_tipo_documento,
        o.orc_valor_entrada,

        -- Dados da requisição
        r.req_id_composto,
        r.req_status,
        r.req_cod_credor,
        r.req_codcomprador,
        r.req_previsao_chegada,
        r.req_observacao,
        r.req_codusr as usuario_responsavel,
        r.req_unm_id_entrega,
        r.req_unm_id_destino,

        -- Dados do fornecedor
        CAST(f.cod_credor AS TEXT) as fornecedor_codigo,
        f.nome as fornecedor_nome,
        f.cpf_cgc as fornecedor_cpf_cnpj,

        -- Dados do comprador
        CAST(c.codcomprador AS TEXT) as comprador_codigo,
        c.nome as comprador_nome,

        -- Locais de entrega e destino
        ue.unm_nome as local_entrega,
        ud.unm_nome as local_destino,

        -- Usar valor total armazenado na ordem
        o.orc_valor_total as valor_total,
        o.orc_observacao,
        o.orc_previsao_chegada,

        -- Calcular prazo de entrega em dias (prioriza previsão da ordem)
        CASE
          WHEN COALESCE(o.orc_previsao_chegada, r.req_previsao_chegada) IS NOT NULL
          THEN EXTRACT(DAY FROM (COALESCE(o.orc_previsao_chegada, r.req_previsao_chegada) - o.orc_data))::INTEGER
          ELSE NULL
        END as prazo_entrega

      FROM db_manaus.cmp_ordem_compra o

      -- LEFT JOIN com requisição (pode não existir - dados órfãos)
      LEFT JOIN db_manaus.cmp_requisicao r
        ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao

      -- LEFT JOINs para dados relacionados
      LEFT JOIN db_manaus.dbcredor f
        ON r.req_cod_credor = f.cod_credor

      LEFT JOIN db_manaus.dbcompradores c
        ON r.req_codcomprador = c.codcomprador

      -- LEFT JOINs para locais de entrega (prioriza ordem, fallback para requisição)
      LEFT JOIN db_manaus.cad_unidade_melo ue
        ON COALESCE(o.orc_unm_id_entrega, r.req_unm_id_entrega) = ue.unm_id

      LEFT JOIN db_manaus.cad_unidade_melo ud
        ON COALESCE(o.orc_unm_id_destino, r.req_unm_id_destino) = ud.unm_id

      WHERE 1=1
      ${whereClause.replace('WHERE', 'AND')}
      ORDER BY o.orc_data DESC, o.orc_id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    const ordensResult = await client.query(ordensQuery, [...params, limit, offset]);

    const ordensCompletas = ordensResult.rows.map(ordem => ({
      // Dados da ordem
      orc_id: ordem.orc_id,
      orc_req_id: ordem.orc_req_id,
      orc_req_versao: ordem.orc_req_versao,
      orc_data: ordem.orc_data,
      orc_status: ordem.orc_status,

      // Dados de pagamento
      orc_pagamento_configurado: ordem.orc_pagamento_configurado || false,
      orc_banco: ordem.orc_banco || null,
      orc_tipo_documento: ordem.orc_tipo_documento || null,
      orc_valor_entrada: ordem.orc_valor_entrada ? parseFloat(ordem.orc_valor_entrada) : 0,

      // Dados herdados da requisição (podem ser null se órfão)
      req_id_composto: ordem.req_id_composto || `${ordem.orc_req_id}`,
      req_status: ordem.req_status || 'ÓRFÃ',
      observacao: ordem.req_observacao || `Ordem órfã - requisição ${ordem.orc_req_id} não encontrada`,

      // Fornecedor
      fornecedor_codigo: ordem.fornecedor_codigo || '',
      fornecedor_nome: ordem.fornecedor_nome || '',
      fornecedor_completo: (ordem.fornecedor_codigo && ordem.fornecedor_nome) ?
        `${ordem.fornecedor_codigo} - ${ordem.fornecedor_nome}` :
        ordem.req_status === 'ÓRFÃ' ? '📋 Dados perdidos (Req: ' + ordem.orc_req_id + ')' : '',
      fornecedor_cpf_cnpj: ordem.fornecedor_cpf_cnpj || '',

      // Comprador
      comprador_codigo: ordem.comprador_codigo || '',
      comprador_nome: ordem.comprador_nome || '',
      comprador_completo: (ordem.comprador_codigo && ordem.comprador_nome) ?
        `${ordem.comprador_codigo} - ${ordem.comprador_nome}` :
        ordem.req_status === 'ÓRFÃ' ? '📋 Dados perdidos (Req: ' + ordem.orc_req_id + ')' : '',

      // Novos campos importantes
      orc_valor_total: parseFloat(ordem.valor_total) || 0,
      valor_total: parseFloat(ordem.valor_total) || 0,  // compatibilidade
      orc_observacao: ordem.orc_observacao || '',
      orc_previsao_chegada: ordem.orc_previsao_chegada || null,
      usuario_responsavel: ordem.usuario_responsavel || '',
      local_entrega: ordem.local_entrega || '',
      local_destino: ordem.local_destino || '',
      req_previsao_chegada: ordem.req_previsao_chegada,
      prazo_entrega: ordem.prazo_entrega || null,

      // Formatar data de previsão de chegada
      data_previsao_formatada: ordem.req_previsao_chegada ?
        new Date(ordem.req_previsao_chegada).toLocaleDateString('pt-BR') : '',

      // Status de finalização
      data_finalizacao: ordem.orc_status === 'F' ? ordem.orc_data : null
    }));

    client.release();
    
    res.status(200).json({ 
      success: true,
      data: ordensCompletas,
      total: total,
      meta: {
        total: total,
        currentPage: pageNum,
        lastPage: Math.ceil(total / limit),
        perPage: limit
      }
    });
    
  } catch (err) {
    console.error('Erro ao listar ordens de compra:', err);

    res.status(500).json({
      success: false,
      data: [],
      total: 0,
      error: 'Erro ao buscar ordens de compra no banco de dados',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
}