/**
 * POST /api/importacao/vincular-pedidos
 * Tenta vincular automaticamente itens (que já têm codprod) a pedidos de compra aprovados.
 *
 * Para cada item com codprod + fornecedor, busca em cmp_it_requisicao
 * JOIN cmp_ordem_compra onde status='A' e há quantidade pendente.
 *
 * Aceita cod_credor direto OU fornecedor_nome (resolve automaticamente via dbcredor).
 *
 * Body:
 *   { itens: [{ codprod, faturaIdx, itemIdx }], cod_credor?: string, fornecedor_nome?: string }
 *
 * Response:
 *   { success, cod_credor_resolvido, resultados: [...] }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';

interface ItemInput {
  codprod: string;
  faturaIdx: number;
  itemIdx: number;
  qtd: number;
}

const QUERY_RESOLVER_FORNECEDOR = `
  SELECT cod_credor, nome
  FROM db_manaus.dbcredor
  WHERE UPPER(TRIM(nome)) LIKE UPPER(TRIM($1)) || '%'
  ORDER BY cod_credor
  LIMIT 1
`;

const QUERY_PEDIDOS_POR_PRODUTO = `
  SELECT
    orc.orc_id,
    itr.itr_codprod,
    (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) AS qtd_disponivel,
    itr.itr_pr_unitario
  FROM db_manaus.cmp_it_requisicao itr
  JOIN db_manaus.cmp_requisicao req
    ON req.req_id = itr.itr_req_id AND req.req_versao = itr.itr_req_versao
  JOIN db_manaus.cmp_ordem_compra orc
    ON orc.orc_req_id = req.req_id AND orc.orc_req_versao = req.req_versao
  WHERE orc.orc_status = 'A'
    AND req.req_cod_credor = $1
    AND itr.itr_codprod = $2
    AND (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) > 0
  ORDER BY orc.orc_data DESC
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo || 'MANAUS';
  const pool = getPgPool(filial);

  const itens: ItemInput[] = req.body.itens || [];
  let codCredor: string = req.body.cod_credor || '';
  const fornecedorNome: string = req.body.fornecedor_nome || '';

  if (itens.length === 0) {
    return res.status(400).json({ message: 'Itens são obrigatórios' });
  }

  let client;
  try {
    client = await pool.connect();

    // Se não tem cod_credor mas tem fornecedor_nome, resolver automaticamente
    if (!codCredor && fornecedorNome) {
      const resolverResult = await client.query(QUERY_RESOLVER_FORNECEDOR, [fornecedorNome]);
      if (resolverResult.rows.length > 0) {
        codCredor = resolverResult.rows[0].cod_credor;
        console.log(`[vincular-pedidos] Fornecedor resolvido: "${fornecedorNome}" → cod_credor=${codCredor}`);
      } else {
        console.log(`[vincular-pedidos] Fornecedor não encontrado: "${fornecedorNome}"`);
        return res.status(200).json({
          success: true,
          cod_credor_resolvido: null,
          resultados: [],
          stats: { total: itens.length, vinculados: 0 },
          message: `Fornecedor "${fornecedorNome}" não encontrado no cadastro`,
        });
      }
    }

    if (!codCredor) {
      return res.status(400).json({ message: 'cod_credor ou fornecedor_nome são obrigatórios' });
    }

    const resultados: {
      faturaIdx: number;
      itemIdx: number;
      id_orc: number;
      orc_id: string;
      qtd_disponivel: number;
    }[] = [];

    // Map para rastrear quantidade já consumida por OC+codprod nesta execução
    const qtdConsumida = new Map<string, number>();

    for (const item of itens) {
      if (!item.codprod) continue;

      const result = await client.query(QUERY_PEDIDOS_POR_PRODUTO, [codCredor, item.codprod]);

      // Percorrer OCs e pegar a primeira com quantidade suficiente
      for (const row of result.rows) {
        const chave = `${row.orc_id}|${item.codprod}`;
        const jaConsumido = qtdConsumida.get(chave) || 0;
        const disponivel = parseFloat(String(row.qtd_disponivel)) - jaConsumido;

        if (disponivel > 0) {
          const qtdItem = item.qtd || 1;
          qtdConsumida.set(chave, jaConsumido + qtdItem);
          resultados.push({
            faturaIdx: item.faturaIdx,
            itemIdx: item.itemIdx,
            id_orc: parseInt(String(row.orc_id)),
            orc_id: String(row.orc_id),
            qtd_disponivel: disponivel,
          });
          break;
        }
      }
    }

    console.log(`[vincular-pedidos] ${resultados.length}/${itens.length} vinculados para fornecedor ${codCredor}`);

    return res.status(200).json({
      success: true,
      cod_credor_resolvido: codCredor,
      resultados,
      stats: {
        total: itens.length,
        vinculados: resultados.length,
      },
    });
  } catch (error: any) {
    console.error('[vincular-pedidos] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao vincular pedidos',
    });
  } finally {
    if (client) client.release();
  }
}
