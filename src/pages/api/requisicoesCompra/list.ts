// API para listagem de requisições de compra com formato padrão
import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { RequisitionDTO } from '@/types/compras';

interface ListRequisitionsResponse {
  success: boolean;
  data: RequisitionDTO[];
  total: number;
  page: number;
  limit: number;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListRequisitionsResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      data: [],
      total: 0,
      page: 1,
      limit: 25,
      message: `Method ${req.method} Not Allowed`
    });
  }

  const {
    page = '1',
    limit = '25',
    search = '',
    status,
    fornecedor,
    comprador,
    dataInicio,
    dataFim
  } = req.query;

  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 25;
  const offset = (pageNum - 1) * limitNum;

  let client;
  try {
    client = await pool.connect();

    // Query com JOINs para buscar nomes de fornecedor e comprador + dados da ordem
    let query = `
      SELECT
        r.req_id as id,
        r.req_versao as versao,
        CAST(r.req_id AS TEXT) as requisicao,
        r.req_data as "dataRequisicao",
        r.req_status as "statusRequisicao",
        r.req_observacao as observacao,
        r.req_tipo as "tipoSigla",
        COALESCE(tr.ret_descricao, r.req_tipo) as tipo,
        r.req_cod_credor as "fornecedorCodigo",
        r.req_codcomprador as "compradorCodigo",
        CAST(f.cod_credor AS TEXT) as "fornecedorCodigoReal",
        f.nome as "fornecedorNome",
        f.cpf_cgc as "fornecedorCpfCnpj",
        COALESCE(
          CASE 
            WHEN f.nome IS NOT NULL AND f.nome != '' THEN f.cod_credor || ' - ' || f.nome
            WHEN r.req_cod_credor IS NOT NULL AND r.req_cod_credor != '' THEN r.req_cod_credor || ' - (Fornecedor não encontrado)'
            ELSE ''
          END, ''
        ) as "fornecedorCompleto",
        CAST(c.codcomprador AS TEXT) as "compradorCodigoReal",
        c.nome as "compradorNome",
        COALESCE(
          CASE 
            WHEN c.nome IS NOT NULL AND c.nome != '' THEN r.req_codcomprador || ' - ' || c.nome
            WHEN r.req_codcomprador IS NOT NULL AND r.req_codcomprador != '' THEN r.req_codcomprador || ' - (Comprador não encontrado)'
            ELSE ''
          END, ''
        ) as "compradorCompleto",
        r.req_cond_pagto as "condPagto",
        r.req_previsao_chegada as "previsaoChegada",
        ue.unm_nome as "localEntrega",
        ud.unm_nome as "destino",
        COALESCE(oc.orc_id, 0) as "ordemCompra",
        oc.orc_data as "dataOrdem",
        oc.orc_status as "statusOrdem",
        COALESCE((
          SELECT SUM(itr_quantidade * itr_pr_unitario)
          FROM db_manaus.cmp_it_requisicao
          WHERE itr_req_id = r.req_id
        ), 0) as "valorTotal"
      FROM db_manaus.cmp_requisicao r
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN db_manaus.cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN db_manaus.cmp_requisicao_tipo tr ON r.req_tipo = tr.ret_id
      LEFT JOIN (
        SELECT DISTINCT ON (orc_req_id, orc_req_versao)
               orc_req_id, orc_req_versao, orc_id, orc_data, orc_status
        FROM db_manaus.cmp_ordem_compra
        WHERE orc_data >= '2020-01-01'
        ORDER BY orc_req_id, orc_req_versao, orc_id DESC
      ) oc ON (r.req_id = oc.orc_req_id AND r.req_versao = oc.orc_req_versao)
      WHERE r.req_id IS NOT NULL
        AND r.req_data >= '2020-01-01'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filtro de busca geral (incluindo códigos e datas)
    if (search) {
      query += ` AND (
        r.req_id_composto ILIKE $${paramIndex} OR
        CAST(r.req_id AS TEXT) ILIKE $${paramIndex} OR
        f.nome ILIKE $${paramIndex} OR
        CAST(f.cod_credor AS TEXT) ILIKE $${paramIndex} OR
        c.nome ILIKE $${paramIndex} OR
        CAST(c.codcomprador AS TEXT) ILIKE $${paramIndex} OR
        f.cpf_cgc ILIKE $${paramIndex} OR
        TO_CHAR(r.req_data, 'DD/MM/YYYY') ILIKE $${paramIndex} OR
        TO_CHAR(r.req_previsao_chegada, 'DD/MM/YYYY') ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por status
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      const statusPlaceholders = statusArray.map(() => `$${paramIndex++}`).join(', ');
      query += ` AND r.req_status IN (${statusPlaceholders})`;
      params.push(...statusArray);
    }

    // Filtro por fornecedor (nome ou código)
    if (fornecedor) {
      query += ` AND (f.nome ILIKE $${paramIndex} OR CAST(f.cod_credor AS TEXT) ILIKE $${paramIndex})`;
      params.push(`%${fornecedor}%`);
      paramIndex++;
    }

    // Filtro por comprador (nome ou código)
    if (comprador) {
      query += ` AND (c.nome ILIKE $${paramIndex} OR CAST(c.codcomprador AS TEXT) ILIKE $${paramIndex})`;
      params.push(`%${comprador}%`);
      paramIndex++;
    }

    // Filtro por data início
    if (dataInicio) {
      query += ` AND r.req_data >= $${paramIndex}`;
      params.push(dataInicio);
      paramIndex++;
    }

    // Filtro por data fim
    if (dataFim) {
      query += ` AND r.req_data <= $${paramIndex}`;
      params.push(dataFim);
      paramIndex++;
    }

    // Ordenação
    query += ` ORDER BY r.req_data DESC, r.req_id DESC`;

    // Paginação
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    // Executar query principal
    console.log('DEBUG - Query sendo executada:', query.substring(0, 200) + '...');
    const result = await client.query(query, params);
    console.log('DEBUG - Resultados encontrados:', result.rows.length);
    
    // Debug: mostrar algumas amostras dos dados
    if (result.rows.length > 0) {
      console.log('DEBUG - Amostra de dados (primeiro item):', {
        id: result.rows[0].id,
        requisicao: result.rows[0].requisicao,
        statusRequisicao: result.rows[0].statusRequisicao,
        ordemCompra: result.rows[0].ordemCompra
      });
    }

    // Query para contar com JOINs
    let countQuery = `
      SELECT COUNT(*) as total
      FROM db_manaus.cmp_requisicao r
      LEFT JOIN db_manaus.dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN db_manaus.dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN db_manaus.cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN db_manaus.cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      LEFT JOIN db_manaus.cmp_requisicao_tipo tr ON r.req_tipo = tr.ret_id
      LEFT JOIN (
        SELECT DISTINCT ON (orc_req_id, orc_req_versao)
               orc_req_id, orc_req_versao, orc_id, orc_data, orc_status
        FROM db_manaus.cmp_ordem_compra
        WHERE orc_data >= '2020-01-01'
        ORDER BY orc_req_id, orc_req_versao, orc_id DESC
      ) oc ON (r.req_id = oc.orc_req_id AND r.req_versao = oc.orc_req_versao)
      WHERE r.req_id IS NOT NULL
        AND r.req_data >= '2020-01-01'
    `;

    const countParams: any[] = [];
    let countParamIndex = 1;

    // Aplicar os mesmos filtros na contagem
    if (search) {
      countQuery += ` AND (
        r.req_id_composto ILIKE $${countParamIndex} OR
        CAST(r.req_id AS TEXT) ILIKE $${countParamIndex} OR
        f.nome ILIKE $${countParamIndex} OR
        CAST(f.cod_credor AS TEXT) ILIKE $${countParamIndex} OR
        c.nome ILIKE $${countParamIndex} OR
        CAST(c.codcomprador AS TEXT) ILIKE $${countParamIndex} OR
        f.cpf_cgc ILIKE $${countParamIndex} OR
        TO_CHAR(r.req_data, 'DD/MM/YYYY') ILIKE $${countParamIndex} OR
        TO_CHAR(r.req_previsao_chegada, 'DD/MM/YYYY') ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      const statusPlaceholders = statusArray.map(() => `$${countParamIndex++}`).join(', ');
      countQuery += ` AND r.req_status IN (${statusPlaceholders})`;
      countParams.push(...statusArray);
    }

    if (fornecedor) {
      countQuery += ` AND (f.nome ILIKE $${countParamIndex} OR CAST(f.cod_credor AS TEXT) ILIKE $${countParamIndex})`;
      countParams.push(`%${fornecedor}%`);
      countParamIndex++;
    }

    if (comprador) {
      countQuery += ` AND (c.nome ILIKE $${countParamIndex} OR CAST(c.codcomprador AS TEXT) ILIKE $${countParamIndex})`;
      countParams.push(`%${comprador}%`);
      countParamIndex++;
    }

    if (dataInicio) {
      countQuery += ` AND r.req_data >= $${countParamIndex}`;
      countParams.push(dataInicio);
      countParamIndex++;
    }

    if (dataFim) {
      countQuery += ` AND r.req_data <= $${countParamIndex}`;
      countParams.push(dataFim);
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Formatar dados para resposta
    const formattedData: RequisitionDTO[] = result.rows.map(row => ({
      id: row.id,
      versao: row.versao,
      requisicao: row.requisicao,
      dataRequisicao: row.dataRequisicao,
      statusRequisicao: row.statusRequisicao,
      condPagto: row.condPagto,
      observacao: row.observacao,
      tipo: row.tipo,
      previsaoChegada: row.previsaoChegada,
      fornecedorCodigo: row.fornecedorCodigoReal || row.fornecedorCodigo,
      fornecedorNome: row.fornecedorNome,
      fornecedorCompleto: row.fornecedorCompleto || '',
      fornecedorCpfCnpj: row.fornecedorCpfCnpj,
      compradorCodigo: row.compradorCodigoReal || row.compradorCodigo,
      compradorNome: row.compradorNome,
      compradorCompleto: row.compradorCompleto || '',
      localEntrega: row.localEntrega,
      destino: row.destino,
      ordemCompra: row.ordemCompra,
      dataOrdem: row.dataOrdem,
      statusOrdem: row.statusOrdem,
      valorTotal: parseFloat(row.valorTotal) || 0
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
      total,
      page: pageNum,
      limit: limitNum
    });

  } catch (error) {
    console.error('Erro ao buscar requisições:', error);
    res.status(500).json({
      success: false,
      data: [],
      total: 0,
      page: pageNum,
      limit: limitNum,
      message: 'Erro interno do servidor ao buscar requisições'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}