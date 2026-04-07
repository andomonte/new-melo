/**
 * GET /api/importacao/itens-pedido
 * Lista itens de pedidos de compra aprovados por fornecedor.
 * Usado pelo modal "Importar do Pedido" para selecionar itens manualmente.
 *
 * Aceita cod_credor direto OU fornecedor_nome (resolve automaticamente via dbcredor).
 *
 * Query params:
 *   cod_credor      - código do fornecedor (opcional se fornecedor_nome presente)
 *   fornecedor_nome - nome do fornecedor para resolver cod_credor (fallback)
 *   search          - texto para filtrar por ref/descricao (opcional)
 *
 * Response:
 *   { success, cod_credor_resolvido, itens: [...] }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

const QUERY_RESOLVER_FORNECEDOR = `
  SELECT cod_credor, nome
  FROM db_manaus.dbcredor
  WHERE UPPER(TRIM(nome)) LIKE UPPER(TRIM($1)) || '%'
  ORDER BY cod_credor
  LIMIT 1
`;

const QUERY_ITENS_PEDIDO = `
  SELECT
    orc.orc_id,
    p.codprod,
    p.ref,
    p.descr AS descricao,
    itr.itr_quantidade AS qtd_total,
    COALESCE(itr.itr_quantidade_atendida, 0) AS qtd_atendida,
    (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) AS qtd_disponivel,
    itr.itr_pr_unitario AS preco_unit,
    p.unimed AS unidade,
    p.clasfiscal AS ncm
  FROM db_manaus.cmp_it_requisicao itr
  JOIN db_manaus.dbprod p ON p.codprod = itr.itr_codprod
  JOIN db_manaus.cmp_requisicao req
    ON req.req_id = itr.itr_req_id AND req.req_versao = itr.itr_req_versao
  JOIN db_manaus.cmp_ordem_compra orc
    ON orc.orc_req_id = req.req_id AND orc.orc_req_versao = req.req_versao
  WHERE orc.orc_status = 'A'
    AND req.req_cod_credor = $1
    AND (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) > 0
  ORDER BY orc.orc_id DESC, p.descr
`;

const QUERY_ITENS_PEDIDO_FILTRO = `
  SELECT
    orc.orc_id,
    p.codprod,
    p.ref,
    p.descr AS descricao,
    itr.itr_quantidade AS qtd_total,
    COALESCE(itr.itr_quantidade_atendida, 0) AS qtd_atendida,
    (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) AS qtd_disponivel,
    itr.itr_pr_unitario AS preco_unit,
    p.unimed AS unidade,
    p.clasfiscal AS ncm
  FROM db_manaus.cmp_it_requisicao itr
  JOIN db_manaus.dbprod p ON p.codprod = itr.itr_codprod
  JOIN db_manaus.cmp_requisicao req
    ON req.req_id = itr.itr_req_id AND req.req_versao = itr.itr_req_versao
  JOIN db_manaus.cmp_ordem_compra orc
    ON orc.orc_req_id = req.req_id AND orc.orc_req_versao = req.req_versao
  WHERE orc.orc_status = 'A'
    AND req.req_cod_credor = $1
    AND (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) > 0
    AND (
      LOWER(p.descr) LIKE LOWER($2)
      OR LOWER(p.ref) LIKE LOWER($2)
      OR p.codprod LIKE $2
      OR orc.orc_id::text LIKE $2
    )
  ORDER BY orc.orc_id DESC, p.descr
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  let codCredor = (req.query.cod_credor as string) || '';
  const fornecedorNome = (req.query.fornecedor_nome as string) || '';
  const search = (req.query.search as string) || '';

  if (!codCredor && !fornecedorNome) {
    return res.status(400).json({ message: 'cod_credor ou fornecedor_nome é obrigatório' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  try {
    // Resolver cod_credor pelo nome se necessário
    if (!codCredor && fornecedorNome) {
      const resolverResult = await pool.query(QUERY_RESOLVER_FORNECEDOR, [fornecedorNome]);
      if (resolverResult.rows.length > 0) {
        codCredor = resolverResult.rows[0].cod_credor;
      } else {
        return res.status(200).json({
          success: true,
          cod_credor_resolvido: null,
          itens: [],
          total: 0,
          message: `Fornecedor "${fornecedorNome}" não encontrado no cadastro`,
        });
      }
    }

    let result;
    if (search.trim()) {
      result = await pool.query(QUERY_ITENS_PEDIDO_FILTRO, [codCredor, `%${search.trim()}%`]);
    } else {
      result = await pool.query(QUERY_ITENS_PEDIDO, [codCredor]);
    }

    const itens = result.rows.map((row: any) => ({
      orc_id: String(row.orc_id),
      codprod: row.codprod,
      ref: row.ref || '',
      descricao: row.descricao || '',
      qtd_total: parseFloat(String(row.qtd_total || 0)),
      qtd_atendida: parseFloat(String(row.qtd_atendida || 0)),
      qtd_disponivel: parseFloat(String(row.qtd_disponivel || 0)),
      preco_unit: parseFloat(String(row.preco_unit || 0)),
      unidade: row.unidade || '',
      ncm: row.ncm || '',
    }));

    return res.status(200).json({
      success: true,
      cod_credor_resolvido: codCredor,
      itens,
      total: itens.length,
    });
  } catch (error: any) {
    console.error('[itens-pedido] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao buscar itens do pedido',
    });
  }
}
