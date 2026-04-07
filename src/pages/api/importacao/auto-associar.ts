/**
 * POST /api/importacao/auto-associar
 * Tenta associar automaticamente itens da importação a produtos internos
 *
 * 3 estratégias (em ordem de prioridade):
 *   1. Extrair REF da descrição → buscar em dbprod.ref (match exato)
 *   2. Lookup na tabela de aprendizado (dbref_fabrica + dbprod_ref_fabrica)
 *   3. Similaridade de descrição com dbprod.descr (threshold 40%)
 *
 * Body:
 *   { itens: Array<{ index: number, descricao: string, ncm?: string }> }
 *
 * Response:
 *   { success: true, resultados: Array<{ index, codprod, descricao_produto, estrategia, confianca }> }
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

interface ItemInput {
  index: number;
  descricao: string;
  ncm?: string;
}

interface Resultado {
  index: number;
  codprod: string;
  descricao_produto: string;
  estrategia: 'ref_descricao' | 'aprendizado' | 'similaridade';
  confianca: 'alta' | 'media' | 'baixa';
}

// Resolve o codmarca a partir do nome da marca extraído da descrição
async function resolverCodmarca(client: PoolClient, nomeMarca: string): Promise<string | null> {
  // Tenta match exato
  const exato = await client.query(`
    SELECT codmarca FROM db_manaus.dbmarcas
    WHERE UPPER(TRIM(descr)) = $1
    LIMIT 1
  `, [nomeMarca.toUpperCase().trim()]);

  if (exato.rows.length > 0) return exato.rows[0].codmarca;

  // Tenta LIKE (ex: "MBC" matchando "MBC PARTS")
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

  const itens: ItemInput[] = req.body.itens || [];

  if (itens.length === 0) {
    return res.status(400).json({ message: 'Nenhum item enviado' });
  }

  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    const resultados: Resultado[] = [];
    const jaAssociados = new Set<number>(); // indices já resolvidos
    let refComMarca = 0; // contador de matches por ref que usaram filtro de marca

    // Pré-processar: extrair marca e codmarca para cada item
    const marcasPorItem = new Map<number, { nomeMarca: string | null; codmarca: string | null }>();
    for (const item of itens) {
      const nomeMarca = extrairMarca(item.descricao);
      let codmarca: string | null = null;
      if (nomeMarca) {
        codmarca = await resolverCodmarca(client, nomeMarca);
        if (codmarca) {
          console.log(`[auto-associar] Marca "${nomeMarca}" → codmarca ${codmarca}`);
        } else {
          console.log(`[auto-associar] Marca "${nomeMarca}" não encontrada no banco`);
        }
      }
      marcasPorItem.set(item.index, { nomeMarca, codmarca });
    }

    // =========================================================================
    // Função auxiliar: executar as 3 estratégias com filtro strib opcional
    // =========================================================================
    async function executarEstrategias(filtroInternacional: boolean, itensAlvo: ItemInput[]) {
      const filtroStrib = filtroInternacional ? `AND LEFT(TRIM(p.strib), 1) = '1'` : '';
      const label = filtroInternacional ? '(internacional)' : '(fallback sem filtro strib)';

      // =====================================================================
      // ESTRATÉGIA 1: Extrair REF da descrição → buscar em dbprod.ref
      // =====================================================================
      console.log(`[auto-associar] Estratégia 1 ${label}: Busca por REF na descrição...`);

      for (const item of itensAlvo) {
        if (jaAssociados.has(item.index)) continue;

        const refs = extrairRefs(item.descricao);
        if (refs.length === 0) continue;

        const { codmarca } = marcasPorItem.get(item.index) || { codmarca: null };

        for (const ref of refs) {
          const result = await client!.query(`
            SELECT p.codprod, p.descr, p.ref, m.descr as marca_nome
            FROM db_manaus.dbprod p
            LEFT JOIN db_manaus.dbmarcas m ON m.codmarca = p.codmarca
            WHERE p.ref = $1
              AND COALESCE(p.excluido, 0) != 1
              ${filtroStrib}
              AND ($2::varchar IS NULL OR p.codmarca = $2)
            LIMIT 1
          `, [ref, codmarca]);

          if (result.rows.length > 0) {
            const prod = result.rows[0];
            resultados.push({
              index: item.index,
              codprod: prod.codprod,
              descricao_produto: prod.descr,
              estrategia: 'ref_descricao',
              confianca: 'alta',
            });
            jaAssociados.add(item.index);
            if (codmarca) refComMarca++;
            console.log(`[auto-associar] REF ${ref} → ${prod.codprod} (marca: ${prod.marca_nome || 'N/A'})`);
            break;
          }
        }
      }

      console.log(`[auto-associar] Estratégia 1 ${label}: ${jaAssociados.size}/${itens.length} encontrados`);

      // =====================================================================
      // ESTRATÉGIA 2: Lookup na tabela de aprendizado (dbref_fabrica)
      // =====================================================================
      console.log(`[auto-associar] Estratégia 2 ${label}: Busca por aprendizado...`);

      for (const item of itensAlvo) {
        if (jaAssociados.has(item.index)) continue;

        const refs = extrairRefs(item.descricao);
        if (refs.length === 0) continue;

        for (const ref of refs) {
          const result = await client!.query(`
            SELECT
              p.codprod,
              p.descr
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
            resultados.push({
              index: item.index,
              codprod: prod.codprod,
              descricao_produto: prod.descr,
              estrategia: 'aprendizado',
              confianca: 'alta',
            });
            jaAssociados.add(item.index);
            break;
          }
        }
      }

      console.log(`[auto-associar] Estratégia 2 ${label}: ${jaAssociados.size}/${itens.length} encontrados (acumulado)`);

      // =====================================================================
      // ESTRATÉGIA 3: Similaridade de descrição
      // =====================================================================
      console.log(`[auto-associar] Estratégia 3 ${label}: Busca por similaridade...`);

      const pendentes3 = itensAlvo.filter(i => !jaAssociados.has(i.index));

      for (const item of pendentes3) {
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

        const { codmarca } = marcasPorItem.get(item.index) || { codmarca: null };

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
            resultados.push({
              index: item.index,
              codprod: melhorMatch.codprod,
              descricao_produto: melhorMatch.descr,
              estrategia: 'similaridade',
              confianca: melhorMatch.score >= 70 ? 'media' : 'baixa',
            });
            jaAssociados.add(item.index);
          }
        }
      }

      console.log(`[auto-associar] Estratégia 3 ${label}: ${jaAssociados.size}/${itens.length} encontrados (acumulado)`);
    }

    // =========================================================================
    // EXECUÇÃO: Primeiro com filtro internacional, depois fallback
    // =========================================================================
    await executarEstrategias(true, itens);

    // Fallback: itens ainda pendentes, tentar sem filtro strib
    const pendentesAposFiltro = itens.filter(i => !jaAssociados.has(i.index));
    if (pendentesAposFiltro.length > 0) {
      console.log(`[auto-associar] Fallback: ${pendentesAposFiltro.length} itens pendentes, tentando sem filtro strib...`);
      await executarEstrategias(false, pendentesAposFiltro);
    }

    console.log(`[auto-associar] Final: ${resultados.length}/${itens.length} associados`);

    // Estatísticas por estratégia
    const stats = {
      total: itens.length,
      associados: resultados.length,
      por_ref: resultados.filter(r => r.estrategia === 'ref_descricao').length,
      por_ref_com_marca: refComMarca,
      por_aprendizado: resultados.filter(r => r.estrategia === 'aprendizado').length,
      por_similaridade: resultados.filter(r => r.estrategia === 'similaridade').length,
      filtro_internacional: true,
    };

    console.log(`[auto-associar] Stats:`, stats);

    return res.status(200).json({
      success: true,
      resultados,
      stats,
    });
  } catch (error: any) {
    console.error('[auto-associar] Erro:', error);
    return res.status(500).json({
      message: error.message || 'Erro ao auto-associar',
    });
  } finally {
    if (client) client.release();
  }
}
