import type { NextApiRequest, NextApiResponse } from 'next';
import { getPgPool } from '@/lib/pgClient';

interface OrdemCompraDisponivel {
  id: string;
  codigoRequisicao: string;
  filial: string;
  codCredor: string;
  fornecedor: string;
  quantidadeDisponivel: number;
  valorUnitario: number;
  dataPrevisao: string;
  multiplo: number;
  descricaoMarca: string;
  precoCompra: number;
  dolar: number;
}

interface PedidosDisponiveisResponse {
  success: boolean;
  data: OrdemCompraDisponivel[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PedidosDisponiveisResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { produtoId, fornecedorCnpj, ordemId } = req.query;

  if (!produtoId || typeof produtoId !== 'string') {
    return res.status(400).json({
      error: 'ID do produto é obrigatório'
    });
  }

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    console.log('Carregando pedidos para produto:', produtoId);
    if (fornecedorCnpj) console.log('Filtro por fornecedor CNPJ:', fornecedorCnpj);
    if (ordemId) console.log('Filtro por ordem específica:', ordemId);

    // Construir query com filtros opcionais
    let query = `
      SELECT
        o.orc_id as id,
        r.req_id_composto as codigo_requisicao,
        'MATRIZ' as filial,
        COALESCE(r.req_cod_credor::text, '') as cod_credor,
        COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor,
        c.cpf_cgc as fornecedor_cnpj,
        ri.itr_codprod as produto_id,
        p.descr as produto_descricao,
        COALESCE(m.descr, 'SEM MARCA') as marca_descricao,
        ri.itr_quantidade as quantidade_pedida,
        COALESCE(ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0), 0) as quantidade_disponivel,
        COALESCE(ri.itr_pr_unitario, 0) as valor_unitario,
        CURRENT_DATE + INTERVAL '30 days' as data_previsao,
        1 as multiplo,
        5.50 as dolar_atual
      FROM db_manaus.cmp_ordem_compra o
      INNER JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      INNER JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      INNER JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
      LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
      LEFT JOIN db_manaus.dbcredor c ON r.req_cod_credor = c.cod_credor
      WHERE ri.itr_codprod = $1
        AND o.orc_status = 'A'
        AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
    `;

    const params: (string | number)[] = [produtoId];
    let paramIndex = 2;

    // Filtro por CNPJ do fornecedor (remove caracteres não numéricos para comparar)
    if (fornecedorCnpj && typeof fornecedorCnpj === 'string') {
      const cnpjLimpo = fornecedorCnpj.replace(/\D/g, '');
      query += ` AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $${paramIndex}`;
      params.push(cnpjLimpo);
      paramIndex++;
    }

    // Filtro por ordem específica (quando vem da tabela de correspondência)
    if (ordemId && typeof ordemId === 'string') {
      query += ` AND o.orc_id = $${paramIndex}`;
      params.push(parseInt(ordemId));
      paramIndex++;
    }

    query += ` ORDER BY o.orc_data ASC, o.orc_id ASC LIMIT 20`;

    let result = await client.query(query, params);

    console.log('Pedidos encontrados no banco:', result.rows.length);

    // Fallback: se não encontrou pelo produto, buscar por fornecedor CNPJ
    if (result.rows.length === 0 && fornecedorCnpj && typeof fornecedorCnpj === 'string') {
      console.log('Nenhuma OC pelo produto, tentando fallback por fornecedor CNPJ:', fornecedorCnpj);
      const cnpjLimpo = fornecedorCnpj.replace(/\D/g, '');

      let fallbackQuery = `
        SELECT
          o.orc_id as id,
          r.req_id_composto as codigo_requisicao,
          'MATRIZ' as filial,
          COALESCE(r.req_cod_credor::text, '') as cod_credor,
          COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor,
          c.cpf_cgc as fornecedor_cnpj,
          ri.itr_codprod as produto_id,
          p.descr as produto_descricao,
          COALESCE(m.descr, 'SEM MARCA') as marca_descricao,
          ri.itr_quantidade as quantidade_pedida,
          COALESCE(ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0), 0) as quantidade_disponivel,
          COALESCE(ri.itr_pr_unitario, 0) as valor_unitario,
          CURRENT_DATE + INTERVAL '30 days' as data_previsao,
          1 as multiplo,
          5.50 as dolar_atual
        FROM db_manaus.cmp_ordem_compra o
        INNER JOIN db_manaus.cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
        INNER JOIN db_manaus.cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
        INNER JOIN db_manaus.dbprod p ON ri.itr_codprod = p.codprod
        LEFT JOIN db_manaus.dbmarcas m ON p.codmarca = m.codmarca
        LEFT JOIN db_manaus.dbcredor c ON r.req_cod_credor = c.cod_credor
        WHERE o.orc_status = 'A'
          AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
          AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $1
      `;
      const fallbackParams: (string | number)[] = [cnpjLimpo];
      let fbIdx = 2;

      if (ordemId && typeof ordemId === 'string') {
        fallbackQuery += ` AND o.orc_id = $${fbIdx}`;
        fallbackParams.push(parseInt(ordemId));
        fbIdx++;
      }

      fallbackQuery += ` ORDER BY o.orc_data ASC, o.orc_id ASC LIMIT 20`;

      result = await client.query(fallbackQuery, fallbackParams);
      console.log('Fallback por fornecedor encontrou:', result.rows.length, 'ordens');
    }

    // Mapear os dados reais
    const ordens: OrdemCompraDisponivel[] = result.rows.map((row: any) => ({
      id: row.id?.toString() || '',
      codigoRequisicao: row.codigo_requisicao?.toString() || row.id?.toString() || '',
      filial: row.filial || 'MATRIZ',
      codCredor: row.cod_credor || '',
      fornecedor: row.fornecedor || 'FORNECEDOR NÃO INFORMADO',
      quantidadeDisponivel: Number(row.quantidade_disponivel || 0),
      valorUnitario: Number(row.valor_unitario || 0),
      dataPrevisao: row.data_previsao ? new Date(row.data_previsao).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      multiplo: 1,
      descricaoMarca: row.marca_descricao || 'SEM MARCA',
      precoCompra: Number(row.valor_unitario || 0),
      dolar: 5.50
    }));

    // Se não encontrou nenhum pedido real, retornar lista vazia
    if (ordens.length === 0) {
      console.log('Nenhuma ordem de compra encontrada para o produto:', produtoId);
    }

    console.log('Retornando ordens:', ordens.length);

    return res.status(200).json({
      success: true,
      data: ordens
    });

  } catch (error) {
    console.error('Erro ao buscar pedidos disponíveis:', error);

    // Fallback em caso de erro
    const ordensFallback: OrdemCompraDisponivel[] = [
      {
        id: `ERRO-${produtoId}`,
        codigoRequisicao: `ERRO-${produtoId}`,
        filial: 'MATRIZ',
        codCredor: '00001',
        fornecedor: 'ERRO - FALLBACK',
        quantidadeDisponivel: 10,
        valorUnitario: 1.00,
        dataPrevisao: new Date().toISOString().split('T')[0],
        multiplo: 1,
        descricaoMarca: 'TESTE',
        precoCompra: 1.00,
        dolar: 5.20
      }
    ];

    return res.status(200).json({
      success: true,
      data: ordensFallback
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}