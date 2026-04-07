/**
 * API de Pendências de Compra - Listagem JSON
 *
 * GET /api/compras/ordens/pendencias - Lista pendências para o grid
 *
 * Parâmetros de query:
 * - filial: string (opcional) - Filtrar por filial de entrega
 * - marca: string (opcional) - Filtrar por código de marca
 * - grupo: string (opcional) - Filtrar por código de grupo de produto
 * - fornecedor: string (opcional) - Filtrar por código de fornecedor
 * - statusOrdem: string (opcional) - Filtrar por status da ordem (A, B, F, C)
 * - page: number (opcional) - Página atual
 * - perPage: number (opcional) - Itens por página
 *
 * @author Sistema Melo
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/lib/db';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const {
    filial,
    marca,
    grupo,
    fornecedor,
    statusOrdem = 'A',
    page = '1',
    perPage = '50'
  } = req.query;

  const pageNum = parseInt(page as string, 10) || 1;
  const perPageNum = parseInt(perPage as string, 10) || 50;
  const offset = (pageNum - 1) * perPageNum;

  let client;
  try {
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    // Construir filtros dinâmicos
    const whereClauses: string[] = [
      'oc.orc_status = $1',
      '(itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) > 0'
    ];
    const params: any[] = [statusOrdem];
    let paramIndex = 2;

    if (filial && filial !== 'TODAS') {
      whereClauses.push(`ue.unm_nome = $${paramIndex}`);
      params.push(filial);
      paramIndex++;
    }

    if (marca) {
      whereClauses.push(`m.codmarca = $${paramIndex}`);
      params.push(marca);
      paramIndex++;
    }

    if (grupo) {
      whereClauses.push(`gp.codgpp = $${paramIndex}`);
      params.push(grupo);
      paramIndex++;
    }

    if (fornecedor) {
      whereClauses.push(`f.cod_credor = $${paramIndex}`);
      params.push(fornecedor);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      INNER JOIN cmp_it_requisicao itr ON (itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao)
      INNER JOIN dbprod p ON itr.itr_codprod = p.codprod
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      LEFT JOIN dbgpprod gp ON p.codgpp = gp.codgpp
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      ${whereString}
    `;

    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Query principal
    const pendenciasQuery = `
      SELECT
        oc.orc_id as "ordemId",
        oc.orc_data as "dataOrdem",
        oc.orc_status as "statusOrdem",
        oc.orc_previsao_chegada as "previsaoChegada",
        r.req_id_composto as "requisicao",
        f.cod_credor as "codFornecedor",
        COALESCE(f.nome, f.nome_fant, 'N/I') as "fornecedor",
        c.nome as "comprador",
        ue.unm_nome as "localEntrega",
        ud.unm_nome as "localDestino",
        p.codprod as "codProduto",
        p.ref as "referencia",
        p.descr as "descricao",
        p.aplic_extendida as "aplicacao",
        m.codmarca as "codMarca",
        m.descr as "marca",
        gp.codgpp as "codGrupo",
        gp.descr as "grupo",
        itr.itr_quantidade as "qtdPedida",
        COALESCE(itr.itr_quantidade_atendida, 0) as "qtdAtendida",
        COALESCE(itr.itr_quantidade_fechada, 0) as "qtdFechada",
        (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) as "pendencia",
        COALESCE(p.qtest, 0) as "estoque",
        COALESCE(p.qtdreservada, 0) as "reservado",
        COALESCE(p.qtest - p.qtdreservada, 0) as "disponivel",
        itr.itr_pr_unitario as "precoUnit",
        (itr.itr_quantidade * itr.itr_pr_unitario) as "valorTotal",
        ((itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) * itr.itr_pr_unitario) as "valorPendente"
      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      INNER JOIN cmp_it_requisicao itr ON (itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao)
      INNER JOIN dbprod p ON itr.itr_codprod = p.codprod
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      LEFT JOIN dbgpprod gp ON p.codgpp = gp.codgpp
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN dbcompradores c ON r.req_codcomprador = c.codcomprador
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      LEFT JOIN cad_unidade_melo ud ON r.req_unm_id_destino = ud.unm_id
      ${whereString}
      ORDER BY ue.unm_nome, m.descr, p.ref, oc.orc_id
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(perPageNum, offset);
    const result = await client.query(pendenciasQuery, params);

    // Buscar totais gerais (sem paginação)
    const totaisQuery = `
      SELECT
        COUNT(*) as "totalItens",
        SUM(itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) as "totalPendencia",
        SUM((itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0) - COALESCE(itr.itr_quantidade_fechada, 0)) * itr.itr_pr_unitario) as "valorTotalPendente"
      FROM cmp_ordem_compra oc
      INNER JOIN cmp_requisicao r ON (oc.orc_req_id = r.req_id AND oc.orc_req_versao = r.req_versao)
      INNER JOIN cmp_it_requisicao itr ON (itr.itr_req_id = r.req_id AND itr.itr_req_versao = r.req_versao)
      INNER JOIN dbprod p ON itr.itr_codprod = p.codprod
      LEFT JOIN dbmarcas m ON p.codmarca = m.codmarca
      LEFT JOIN dbgpprod gp ON p.codgpp = gp.codgpp
      LEFT JOIN dbcredor f ON r.req_cod_credor = f.cod_credor
      LEFT JOIN cad_unidade_melo ue ON r.req_unm_id_entrega = ue.unm_id
      ${whereString}
    `;

    // Remover LIMIT e OFFSET dos params para a query de totais
    const totaisParams = params.slice(0, -2);
    const totaisResult = await client.query(totaisQuery, totaisParams);
    const totais = totaisResult.rows[0];

    // Buscar lista de filiais para o filtro
    const filiaisResult = await client.query(`
      SELECT DISTINCT unm_nome as nome
      FROM cad_unidade_melo
      WHERE unm_nome IS NOT NULL
      ORDER BY unm_nome
    `);

    // Buscar lista de marcas para o filtro
    const marcasResult = await client.query(`
      SELECT DISTINCT m.codmarca, m.descr
      FROM dbmarcas m
      INNER JOIN dbprod p ON p.codmarca = m.codmarca
      INNER JOIN cmp_it_requisicao itr ON itr.itr_codprod = p.codprod
      WHERE m.descr IS NOT NULL
      ORDER BY m.descr
      LIMIT 100
    `);

    res.status(200).json(serializeBigInt({
      success: true,
      data: result.rows,
      meta: {
        total,
        page: pageNum,
        perPage: perPageNum,
        totalPages: Math.ceil(total / perPageNum)
      },
      totais: {
        totalItens: parseInt(totais?.totalItens || '0', 10),
        totalPendencia: parseInt(totais?.totalPendencia || '0', 10),
        valorTotalPendente: parseFloat(totais?.valorTotalPendente || '0')
      },
      filtros: {
        filiais: filiaisResult.rows.map(r => r.nome),
        marcas: marcasResult.rows
      }
    }));

  } catch (error) {
    console.error('❌ Erro ao buscar pendências:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar pendências',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}
