import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface OrdemCompraDisponivel {
  id: string;
  codigoRequisicao: string;
  filial: string;
  codCredor: string;
  fornecedor: string;
  codprod: string;
  descricaoProduto: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
  marca: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { fornecedorCnpj, produtoId, page = '1', limit = '50' } = req.query;

  // Paginação
  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string))); // Max 100 por página
  const offset = (pageNum - 1) * limitNum;

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log('🔍 Buscando ordens disponíveis V2 - Fornecedor:', fornecedorCnpj, 'Produto:', produtoId);

    // Query corrigida com a estrutura real do banco
    let whereClause = `
      WHERE o.orc_status = 'A'
      AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
    `;

    const params: any[] = [];

    // Se tiver produto específico, filtrar por ele
    if (produtoId && produtoId !== 'undefined' && produtoId !== 'null') {
      whereClause += ` AND ri.itr_codprod = $${params.length + 1}`;
      params.push(produtoId);
    }

    // Se tiver CNPJ do fornecedor, filtrar por ele
    if (fornecedorCnpj && fornecedorCnpj !== 'undefined' && fornecedorCnpj !== 'null') {
      // Remover pontuação do CNPJ para comparação
      const cnpjLimpo = fornecedorCnpj.replace(/[^0-9]/g, '');
      if (cnpjLimpo.length > 0) {
        whereClause += ` AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $${params.length + 1}`;
        params.push(cnpjLimpo);
      }
    }

    const query = `
      SELECT DISTINCT
        o.orc_id::text as id,
        COALESCE(r.req_id_composto, o.orc_id::text) as codigo_requisicao,
        COALESCE(me.unm_nome, 'MATRIZ') as filial,
        COALESCE(r.req_cod_credor, '') as cod_credor,
        COALESCE(c.nome, c.razao, 'FORNECEDOR NÃO INFORMADO') as fornecedor,
        ri.itr_codprod as codprod,
        COALESCE(p.descr, p.descricao, 'PRODUTO SEM DESCRIÇÃO') as descricao_produto,
        (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0))::numeric as quantidade_disponivel,
        COALESCE(ri.itr_pr_unitario, 0)::numeric as valor_unitario,
        COALESCE(p.marca, 'SEM MARCA') as marca,
        c.cpf_cgc as cnpj_fornecedor,
        r.req_data as data_requisicao,
        r.req_status as status_requisicao
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      INNER JOIN cmp_it_requisicao ri
        ON r.req_id = ri.itr_req_id
        AND r.req_versao = ri.itr_req_versao
      LEFT JOIN dbprod p
        ON ri.itr_codprod = p.codprod
      LEFT JOIN dbcredor c
        ON r.req_cod_credor = c.cod_credor
      LEFT JOIN dbunidade_melo me
        ON r.req_unm_id_entrega = me.unm_id
      ${whereClause}
      ORDER BY o.orc_id DESC, ri.itr_codprod
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);

    console.log('📋 Query executada com paginação - Página:', pageNum, 'Limite:', limitNum);
    console.log('📌 Parâmetros:', params);

    // Query de contagem total (para calcular total de páginas)
    const countQuery = `
      SELECT COUNT(DISTINCT o.orc_id) as total
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r
        ON o.orc_req_id = r.req_id
        AND o.orc_req_versao = r.req_versao
      INNER JOIN cmp_it_requisicao ri
        ON r.req_id = ri.itr_req_id
        AND r.req_versao = ri.itr_req_versao
      LEFT JOIN dbprod p
        ON ri.itr_codprod = p.codprod
      LEFT JOIN dbcredor c
        ON r.req_cod_credor = c.cod_credor
      LEFT JOIN dbunidade_melo me
        ON r.req_unm_id_entrega = me.unm_id
      ${whereClause}
    `;

    const [result, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2)) // Remove LIMIT e OFFSET do count
    ]);

    const totalRecords = parseInt(countResult.rows[0].total);

    console.log(`✅ Encontradas ${result.rows.length} ordens de compra disponíveis`);

    // Log detalhado para debug
    if (result.rows.length > 0) {
      console.log('📦 Primeiras 3 ordens:', result.rows.slice(0, 3).map(row => ({
        id: row.id,
        produto: row.codprod,
        qtd: row.quantidade_disponivel
      })));
    }

    const ordens: OrdemCompraDisponivel[] = result.rows.map((row: any) => ({
      id: row.id,
      codigoRequisicao: row.codigo_requisicao,
      filial: row.filial,
      codCredor: row.cod_credor,
      fornecedor: row.fornecedor,
      codprod: row.codprod,
      descricaoProduto: row.descricao_produto,
      quantidadeDisponivel: parseFloat(row.quantidade_disponivel),
      valorUnitario: parseFloat(row.valor_unitario),
      marca: row.marca
    }));

    // Se não encontrar ordens, fazer uma query de debug
    if (ordens.length === 0) {
      console.log('⚠️ Nenhuma ordem encontrada, verificando possíveis causas...');

      // Verificar se existem ordens ativas
      const debugQuery1 = `
        SELECT COUNT(*) as total_ordens_ativas
        FROM cmp_ordem_compra
        WHERE orc_status = 'A'
      `;
      const debugResult1 = await client.query(debugQuery1);
      console.log('📊 Total de ordens ativas:', debugResult1.rows[0].total_ordens_ativas);

      // Verificar se existem itens com quantidade disponível
      const debugQuery2 = `
        SELECT COUNT(*) as itens_disponiveis
        FROM cmp_it_requisicao ri
        INNER JOIN cmp_requisicao r ON ri.itr_req_id = r.req_id AND ri.itr_req_versao = r.req_versao
        INNER JOIN cmp_ordem_compra o ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        WHERE o.orc_status = 'A'
        AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
      `;
      const debugResult2 = await client.query(debugQuery2);
      console.log('📊 Itens com quantidade disponível:', debugResult2.rows[0].itens_disponiveis);

      // Se tiver produto específico, verificar se existe
      if (produtoId && produtoId !== 'undefined') {
        const debugQuery3 = `
          SELECT COUNT(*) as produto_existe
          FROM dbprod
          WHERE codprod = $1
        `;
        const debugResult3 = await client.query(debugQuery3, [produtoId]);
        console.log(`📊 Produto ${produtoId} existe:`, debugResult3.rows[0].produto_existe > 0);
      }
    }

    return res.status(200).json({
      success: true,
      data: ordens,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total_records: totalRecords,
        total_pages: Math.ceil(totalRecords / limitNum),
        has_next: pageNum < Math.ceil(totalRecords / limitNum),
        has_prev: pageNum > 1
      },
      debug: {
        produtoId,
        fornecedorCnpj,
        queryParams: params
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar ordens de compra:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar ordens de compra',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}