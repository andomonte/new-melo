/**
 * POST /api/importacao/associar-e-vincular
 * Combina auto-associar (codprod) + vincular-pedidos (id_orc) em uma única operação.
 *
 * Body:
 *   {
 *     id_importacao: number,
 *     faturas: [{
 *       faturaIdx: number,
 *       cod_credor?: string,
 *       fornecedor_nome?: string,
 *       itens: [{ itemIdx, descricao, ncm?, qtd, codprod?, id_orc? }]
 *     }]
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     associacoes: [{ faturaIdx, itemIdx, codprod, descricao_produto, estrategia, confianca }],
 *     vinculacoes: [{ faturaIdx, itemIdx, id_orc, orc_id }],
 *     stats: { ... }
 *   }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import type { PoolClient } from 'pg';
import {
  extrairRefs,
  extrairMarca,
  calcularSimilaridade,
  THRESHOLD_SIMILARIDADE,
  STOPWORDS_SIMILARIDADE,
} from '@/lib/importacao/associacaoHelpers';

interface FaturaInput {
  faturaIdx: number;
  cod_credor?: string;
  fornecedor_nome?: string;
  itens: ItemInput[];
}

interface ItemInput {
  itemIdx: number;
  descricao: string;
  ncm?: string;
  qtd: number;
  codprod?: string;
  id_orc?: number;
}

interface AssociacaoResult {
  faturaIdx: number;
  itemIdx: number;
  codprod: string;
  descricao_produto: string;
  estrategia: 'ref_descricao' | 'aprendizado' | 'similaridade';
  confianca: 'alta' | 'media' | 'baixa';
}

interface VinculacaoResult {
  faturaIdx: number;
  itemIdx: number;
  id_orc: number;
  orc_id: string;
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
    (itr.itr_quantidade - COALESCE(itr.itr_quantidade_atendida, 0)) AS qtd_disponivel
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

async function resolverCodmarca(client: PoolClient, nomeMarca: string): Promise<string | null> {
  const exato = await client.query(`
    SELECT codmarca FROM db_manaus.dbmarcas
    WHERE UPPER(TRIM(descr)) = $1
    LIMIT 1
  `, [nomeMarca.toUpperCase().trim()]);

  if (exato.rows.length > 0) return exato.rows[0].codmarca;

  const like = await client.query(`
    SELECT codmarca FROM db_manaus.dbmarcas
    WHERE UPPER(TRIM(descr)) LIKE $1 || '%'
    LIMIT 1
  `, [nomeMarca.toUpperCase().trim()]);

  if (like.rows.length > 0) return like.rows[0].codmarca;

  return null;
}

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

  const faturas: FaturaInput[] = req.body.faturas || [];

  if (faturas.length === 0) {
    return res.status(400).json({ message: 'Nenhuma fatura enviada' });
  }

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const associacoes: AssociacaoResult[] = [];
    const vinculacoes: VinculacaoResult[] = [];

    // =========================================================================
    // FASE 1: Auto-associar itens sem codprod
    // =========================================================================

    // Coletar todos os itens sem codprod de todas as faturas
    const itensSemCodprod: { faturaIdx: number; itemIdx: number; globalIdx: number; descricao: string; ncm?: string }[] = [];
    let globalIdx = 0;

    for (const fatura of faturas) {
      for (const item of fatura.itens) {
        if (!item.codprod) {
          itensSemCodprod.push({
            faturaIdx: fatura.faturaIdx,
            itemIdx: item.itemIdx,
            globalIdx,
            descricao: item.descricao,
            ncm: item.ncm,
          });
        }
        globalIdx++;
      }
    }

    const jaAssociados = new Set<string>(); // faturaIdx|itemIdx
    let refComMarca = 0;

    if (itensSemCodprod.length > 0) {
      console.log(`[associar-e-vincular] Fase 1: ${itensSemCodprod.length} itens para associar`);

      // Pré-processar marcas
      const marcasPorItem = new Map<string, { nomeMarca: string | null; codmarca: string | null }>();
      for (const item of itensSemCodprod) {
        const key = `${item.faturaIdx}|${item.itemIdx}`;
        const nomeMarca = extrairMarca(item.descricao);
        let codmarca: string | null = null;
        if (nomeMarca) {
          codmarca = await resolverCodmarca(client, nomeMarca);
        }
        marcasPorItem.set(key, { nomeMarca, codmarca });
      }

      // Executar estratégias (primeiro com filtro internacional, depois fallback)
      async function executarEstrategias(filtroInternacional: boolean, itensAlvo: typeof itensSemCodprod) {
        const filtroStrib = filtroInternacional ? `AND LEFT(TRIM(p.strib), 1) = '1'` : '';

        // ESTRATÉGIA 1: REF na descrição
        for (const item of itensAlvo) {
          const key = `${item.faturaIdx}|${item.itemIdx}`;
          if (jaAssociados.has(key)) continue;

          const refs = extrairRefs(item.descricao);
          if (refs.length === 0) continue;

          const { codmarca } = marcasPorItem.get(key) || { codmarca: null };

          for (const ref of refs) {
            const result = await client!.query(`
              SELECT p.codprod, p.descr
              FROM db_manaus.dbprod p
              WHERE p.ref = $1
                AND COALESCE(p.excluido, 0) != 1
                ${filtroStrib}
                AND ($2::varchar IS NULL OR p.codmarca = $2)
              LIMIT 1
            `, [ref, codmarca]);

            if (result.rows.length > 0) {
              const prod = result.rows[0];
              associacoes.push({
                faturaIdx: item.faturaIdx,
                itemIdx: item.itemIdx,
                codprod: prod.codprod,
                descricao_produto: prod.descr,
                estrategia: 'ref_descricao',
                confianca: 'alta',
              });
              jaAssociados.add(key);
              if (codmarca) refComMarca++;
              break;
            }
          }
        }

        // ESTRATÉGIA 2: Aprendizado (dbref_fabrica)
        for (const item of itensAlvo) {
          const key = `${item.faturaIdx}|${item.itemIdx}`;
          if (jaAssociados.has(key)) continue;

          const refs = extrairRefs(item.descricao);
          if (refs.length === 0) continue;

          for (const ref of refs) {
            const result = await client!.query(`
              SELECT p.codprod, p.descr
              FROM db_manaus.dbref_fabrica rf
              INNER JOIN db_manaus.dbprod_ref_fabrica prf ON rf.cod_id = prf.cod_id
              INNER JOIN db_manaus.dbprod p ON prf.codprod = p.codprod
              WHERE rf.referencia = $1
                AND COALESCE(p.excluido, 0) != 1
                ${filtroStrib}
              LIMIT 1
            `, [ref]);

            if (result.rows.length > 0) {
              const prod = result.rows[0];
              associacoes.push({
                faturaIdx: item.faturaIdx,
                itemIdx: item.itemIdx,
                codprod: prod.codprod,
                descricao_produto: prod.descr,
                estrategia: 'aprendizado',
                confianca: 'alta',
              });
              jaAssociados.add(key);
              break;
            }
          }
        }

        // ESTRATÉGIA 3: Similaridade
        const pendentes3 = itensAlvo.filter(i => !jaAssociados.has(`${i.faturaIdx}|${i.itemIdx}`));

        for (const item of pendentes3) {
          const key = `${item.faturaIdx}|${item.itemIdx}`;
          const palavras = item.descricao
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter(p => p.length >= 3)
            .filter(p => !STOPWORDS_SIMILARIDADE.includes(p));

          if (palavras.length < 2) continue;

          const { codmarca } = marcasPorItem.get(key) || { codmarca: null };
          const termoBusca = palavras.slice(0, 3).map(p => `%${p}%`);
          const nextParam = termoBusca.length + 1;

          const whereConditions = termoBusca.map((_, idx) =>
            `LOWER(p.descr) LIKE LOWER($${idx + 1})`
          ).join(' AND ');

          const result = await client!.query(`
            SELECT codprod, descr
            FROM db_manaus.dbprod p
            WHERE ${whereConditions}
              AND COALESCE(excluido, 0) != 1
              ${filtroStrib}
              AND ($${nextParam}::varchar IS NULL OR p.codmarca = $${nextParam})
            ORDER BY codprod
            LIMIT 20
          `, [...termoBusca, codmarca]);

          if (result.rows.length > 0) {
            let melhorMatch: { codprod: string; descr: string; score: number } | null = null;

            for (const candidato of result.rows) {
              const score = calcularSimilaridade(item.descricao, candidato.descr);
              if (score >= THRESHOLD_SIMILARIDADE && (!melhorMatch || score > melhorMatch.score)) {
                melhorMatch = { codprod: candidato.codprod, descr: candidato.descr, score };
              }
            }

            if (melhorMatch) {
              associacoes.push({
                faturaIdx: item.faturaIdx,
                itemIdx: item.itemIdx,
                codprod: melhorMatch.codprod,
                descricao_produto: melhorMatch.descr,
                estrategia: 'similaridade',
                confianca: melhorMatch.score >= 70 ? 'media' : 'baixa',
              });
              jaAssociados.add(key);
            }
          }
        }
      }

      await executarEstrategias(true, itensSemCodprod);

      const pendentesAposFiltro = itensSemCodprod.filter(i => !jaAssociados.has(`${i.faturaIdx}|${i.itemIdx}`));
      if (pendentesAposFiltro.length > 0) {
        await executarEstrategias(false, pendentesAposFiltro);
      }
    }

    // =========================================================================
    // FASE 2: Vincular pedidos para itens com codprod (incluindo recém-associados)
    // =========================================================================

    // Montar mapa de codprods associados nesta operação
    const codprodAssociado = new Map<string, string>();
    for (const a of associacoes) {
      codprodAssociado.set(`${a.faturaIdx}|${a.itemIdx}`, a.codprod);
    }

    // Resolver fornecedores e vincular por fatura
    const qtdConsumidaGlobal = new Map<string, number>();

    for (const fatura of faturas) {
      let codCredor = fatura.cod_credor || '';
      const fornecedorNome = fatura.fornecedor_nome || '';

      // Resolver cod_credor a partir do nome se necessário
      if (!codCredor && fornecedorNome) {
        const resolverResult = await client.query(QUERY_RESOLVER_FORNECEDOR, [fornecedorNome]);
        if (resolverResult.rows.length > 0) {
          codCredor = resolverResult.rows[0].cod_credor;
        }
      }

      if (!codCredor) continue;

      for (const item of fatura.itens) {
        // Já tem id_orc? Pular
        if (item.id_orc) continue;

        // Determinar codprod: do item original ou recém-associado
        const key = `${fatura.faturaIdx}|${item.itemIdx}`;
        const codprod = item.codprod || codprodAssociado.get(key);
        if (!codprod) continue;

        const result = await client.query(QUERY_PEDIDOS_POR_PRODUTO, [codCredor, codprod]);

        for (const row of result.rows) {
          const chave = `${row.orc_id}|${codprod}`;
          const jaConsumido = qtdConsumidaGlobal.get(chave) || 0;
          const disponivel = parseFloat(String(row.qtd_disponivel)) - jaConsumido;

          if (disponivel > 0) {
            const qtdItem = item.qtd || 1;
            qtdConsumidaGlobal.set(chave, jaConsumido + qtdItem);
            vinculacoes.push({
              faturaIdx: fatura.faturaIdx,
              itemIdx: item.itemIdx,
              id_orc: parseInt(String(row.orc_id)),
              orc_id: String(row.orc_id),
            });
            break;
          }
        }
      }
    }

    console.log(`[associar-e-vincular] Resultado: ${associacoes.length} associados, ${vinculacoes.length} vinculados`);

    const stats = {
      total_itens: faturas.reduce((s, f) => s + f.itens.length, 0),
      associados: associacoes.length,
      vinculados: vinculacoes.length,
      por_ref: associacoes.filter(r => r.estrategia === 'ref_descricao').length,
      por_ref_com_marca: refComMarca,
      por_aprendizado: associacoes.filter(r => r.estrategia === 'aprendizado').length,
      por_similaridade: associacoes.filter(r => r.estrategia === 'similaridade').length,
    };

    return res.status(200).json({
      success: true,
      associacoes,
      vinculacoes,
      stats,
    });
  } catch (error: any) {
    console.error('[associar-e-vincular] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao associar e vincular',
    });
  } finally {
    if (client) client.release();
  }
}
