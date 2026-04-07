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

  const { fornecedorCnpj, produtoId, ordemId } = req.query;

  let client;

  try {
    const pool = getPgPool('manaus');
    client = await pool.connect();
    await client.query('SET search_path TO db_manaus');

    console.log('Buscando ordens disponíveis - Fornecedor:', fornecedorCnpj, 'Produto:', produtoId, 'Ordem:', ordemId);

    let whereClause = `
      WHERE o.orc_status = 'A'
      AND (ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0)) > 0
    `;

    const params: any[] = [];

    // Se tiver produto específico, filtrar por ele
    if (produtoId && produtoId !== 'undefined') {
      whereClause += ` AND ri.itr_codprod = $${params.length + 1}`;
      params.push(produtoId);
    }

    // Se tiver CNPJ do fornecedor, filtrar por ele
    if (fornecedorCnpj && fornecedorCnpj !== 'undefined') {
      // Filtrar pelo CNPJ do fornecedor (através da tabela dbcredor)
      whereClause += ` AND REPLACE(REPLACE(REPLACE(c.cpf_cgc, '.', ''), '-', ''), '/', '') = $${params.length + 1}`;
      params.push(fornecedorCnpj.replace(/[^\d]/g, '')); // Remover formatação do CNPJ
      console.log('Filtrando por CNPJ fornecedor:', fornecedorCnpj);
    }

    // Se tiver ordem específica, filtrar só por ela
    if (ordemId && ordemId !== 'undefined') {
      whereClause += ` AND o.orc_id = $${params.length + 1}`;
      params.push(parseInt(ordemId as string));
      console.log('Filtrando por ordem específica:', ordemId);
    }

    // Quando buscando para um produto específico, trazer apenas itens daquele produto
    // A ordem pode ter múltiplos produtos, mas só mostrar o produto relevante
    const query = `
      SELECT
        o.orc_id::text as id,
        COALESCE(r.req_id_composto, o.orc_id::text) as codigo_requisicao,
        'MATRIZ' as filial,
        COALESCE(r.req_cod_credor, '') as cod_credor,
        COALESCE(c.nome, c.nome_fant, 'FORNECEDOR NÃO INFORMADO') as fornecedor,
        ri.itr_codprod as codprod,
        COALESCE(p.descr, 'PRODUTO SEM DESCRIÇÃO') as descricao_produto,
        COALESCE(ri.itr_quantidade - COALESCE(ri.itr_quantidade_atendida, 0), 0)::numeric as quantidade_disponivel,
        COALESCE(ri.itr_pr_unitario, 0)::numeric as valor_unitario,
        'TOYOTA' as marca
      FROM cmp_ordem_compra o
      INNER JOIN cmp_requisicao r ON o.orc_req_id = r.req_id AND o.orc_req_versao = r.req_versao
      INNER JOIN cmp_it_requisicao ri ON r.req_id = ri.itr_req_id AND r.req_versao = ri.itr_req_versao
      LEFT JOIN dbprod p ON ri.itr_codprod = p.codprod
      LEFT JOIN dbcredor c ON r.req_cod_credor = c.cod_credor
      ${whereClause}
      ORDER BY o.orc_id DESC, ri.itr_codprod
      LIMIT 20
    `;

    console.log('Query:', query);
    console.log('Params:', params);

    const result = await client.query(query, params);

    console.log(`Encontradas ${result.rows.length} ordens de compra disponíveis`);

    const ordens: OrdemCompraDisponivel[] = result.rows.map((row: any) => ({
      id: row.id,
      codigoRequisicao: row.codigo_requisicao,
      filial: row.filial,
      codCredor: row.cod_credor,
      fornecedor: row.fornecedor,
      codprod: row.codprod,
      descricaoProduto: row.descricao_produto,
      quantidadeDisponivel: Number(row.quantidade_disponivel),
      valorUnitario: Number(row.valor_unitario),
      marca: row.marca
    }));

    return res.status(200).json({
      success: true,
      data: ordens,
      total: ordens.length
    });

  } catch (error) {
    console.error('Erro ao buscar ordens de compra:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar ordens de compra'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
}