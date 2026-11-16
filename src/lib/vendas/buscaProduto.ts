// src/lib/vendas/buscaProduto.ts
//
// Busca de produto do "Adicionar Itens" (Nova Venda V2). Um campo só:
//
//  - Palavras em qualquer ordem na aplicação: "alavanca fiat" = ALAVANCA e FIAT.
//  - Referência sem pontuação: "02374-BAGE", "02374 BAGE" e "02374BAGE" se equivalem
//    (índice idx_dbprod_ref_norm, migration 081).
//  - "texto | marca": filtra a marca (começa com).
//  - Texto com "%": jeito do Delphi (LIKE direto, começa com).
//  - Sem acento no que se digita (a base quase não tem acento: ~0,4% das aplicações).
//  - Nada encontrado → tenta de novo tolerando erro de digitação (pg_trgm, <%),
//    e marca as linhas com BUSCA_APROXIMADA.
//
// Ordem: referência exata, referência que começa com o texto, aplicação que
// começa com o texto, com estoque disponível, curva (A > B > C > D), estoque.
//
// Desempenho: filtra o dbprod primeiro (índices de aplicação/referência) e só
// então calcula estoque, preço, kickback e margens dos encontrados.
//
// As colunas devolvidas são as mesmas da busca antiga (/api/vendas/postgresql/produto).

import type { PoolClient } from 'pg';

export interface ParamsBuscaProduto {
  termo: string;
  campo: 'ref' | 'aplicacao';
  tipoPreco: string;
  armId: number;
  limite?: number;
}

/** Semelhança mínima por palavra na 2ª tentativa (erro de digitação). */
const LIMITE_APROXIMADO = 0.5;

/** Mesma expressão do índice idx_dbprod_ref_norm (não alterar sem a migration). */
const REF_NORM = `regexp_replace(upper(p.ref), '[^A-Z0-9]', '', 'g')`;

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizarRef = (s: string) => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Escapa curingas do LIKE em texto digitado como palavra (não no modo "%"). */
const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

interface Montagem {
  where: string;
  params: any[];
  refq: string;
  inicioAplic: string;
}

function montar(p: ParamsBuscaProduto, aproximado: boolean): Montagem | null {
  const [parteTermo, ...resto] = p.termo.split('|');
  const texto = semAcento(parteTermo).trim().toUpperCase();
  const marca = semAcento(resto.join('|')).trim().toUpperCase();
  const params: any[] = [];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };

  const refq = normalizarRef(texto);
  const conds: string[] = [];

  if (texto) {
    if (p.campo === 'ref') {
      if (!refq) return null;
      conds.push(`${REF_NORM} LIKE ${add(`${refq}%`)}`);
    } else if (texto.includes('%')) {
      // Delphi: o vendedor escreve o padrão ("%ALAVANCA%FIAT")
      const pad = add(`${texto}%`);
      conds.push(`(p.aplic_extendida ILIKE ${pad} OR p.ref ILIKE ${pad})`);
    } else {
      const palavras = texto.split(/\s+/).filter(Boolean);
      const porPalavra = palavras
        .map((w) =>
          aproximado
            ? `${add(w)} <% p.aplic_extendida` // word_similarity >= limite do pg_trgm
            : `p.aplic_extendida ILIKE ${add(`%${escLike(w)}%`)}`,
        )
        .join(' AND ');
      const porRef = refq.length >= 2 ? ` OR ${REF_NORM} LIKE ${add(`${refq}%`)}` : '';
      conds.push(`((${porPalavra})${porRef})`);
    }
  }
  if (marca) conds.push(`m.descr ILIKE ${add(`${escLike(marca)}%`)}`);
  if (!conds.length) return null;

  return {
    where: conds.join(' AND '),
    params,
    refq,
    inicioAplic: texto.includes('%') ? '' : texto,
  };
}

function sql(m: Montagem, p: ParamsBuscaProduto) {
  const params = [...m.params];
  const add = (v: any) => {
    params.push(v);
    return `$${params.length}`;
  };
  const tipo = add(String(p.tipoPreco ?? '0'));
  const arm = add(p.armId);
  const refq = add(m.refq);
  const inicio = add(m.inicioAplic ? `${escLike(m.inicioAplic)}%` : '');
  const limite = add(p.limite ?? 300);

  const texto = `
    WITH cand AS (
      SELECT p.codprod, p.ref, p.codgpe, p.aplic_extendida, p.dolar, p.codgpp, p.curva,
             m.descr AS marca, ${REF_NORM} AS refnorm
        FROM dbprod p
        JOIN dbmarcas m ON m.codmarca = p.codmarca
       WHERE COALESCE(p.inf, '') <> 'D'
         AND COALESCE(p.excluido, 0) <> 1
         AND ${m.where}
       LIMIT 5000
    ),
    cap AS (
      SELECT arp_codprod AS codprod,
             SUM(arp_qtest) AS qtest,
             SUM(arp_qtest_reservada) AS qtdreservada
        FROM cad_armazem_produto
       WHERE arp_arm_id = ${arm}
         AND COALESCE(arp_bloqueado, 'N') <> 'S'
         AND arp_codprod IN (SELECT codprod FROM cand)
       GROUP BY arp_codprod
    ),
    fp AS (
      SELECT "CODPROD" AS codprod, MAX("PRECOVENDA") AS precovenda
        FROM dbformacaoprvenda
       WHERE "TIPOPRECO"::text = ${tipo}::text
         AND "PRECOVENDA" > 0
         AND "CODPROD" IN (SELECT codprod FROM cand)
       GROUP BY "CODPROD"
    ),
    kb AS (
      SELECT btrim(codprod::text) AS codprod, MAX(dscbalcao45) AS preco_kickback
        FROM dbprecokb
       WHERE dscbalcao45 > 0
         AND codprod IN (SELECT codprod FROM cand)
       GROUP BY btrim(codprod::text)
    )
    SELECT
      c.ref,
      c.codgpe AS "CODGPE",
      c.codprod,
      c.aplic_extendida AS descr,
      COALESCE(cap.qtest, 0) AS qtest,
      COALESCE(cap.qtdreservada, 0) AS qtdreservada,
      COALESCE(cap.qtest, 0) - COALESCE(cap.qtdreservada, 0) AS qtddisponivel,
      c.dolar,
      c.marca AS "MARCA",
      fp.precovenda AS "PRECOVENDA",
      kb.preco_kickback AS "PRECO_KICKBACK",
      seg.margem_min_venda,
      seg.margem_med_venda,
      seg.margem_ide_venda
    FROM cand c
    JOIN cap ON cap.codprod = c.codprod
    JOIN fp ON fp.codprod = c.codprod
    LEFT JOIN kb ON kb.codprod = c.codprod
    LEFT JOIN dbgpprod g ON g.codgpp = c.codgpp
    LEFT JOIN dbsegmento seg ON seg.codseg::text = btrim(g.codseg::text)
    ORDER BY
      (${refq} <> '' AND c.refnorm = ${refq}) DESC,
      (${refq} <> '' AND c.refnorm LIKE ${refq} || '%') DESC,
      (${inicio} <> '' AND c.aplic_extendida ILIKE ${inicio}) DESC,
      (COALESCE(cap.qtest, 0) - COALESCE(cap.qtdreservada, 0) > 0) DESC,
      CASE c.curva WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
      COALESCE(cap.qtest, 0) - COALESCE(cap.qtdreservada, 0) DESC,
      c.ref
    LIMIT ${limite}`;
  return { texto, params };
}

/** Executa a busca; devolve as linhas no formato da busca antiga. */
export async function buscarProdutosVenda(client: PoolClient, p: ParamsBuscaProduto): Promise<any[]> {
  const exata = montar(p, false);
  if (!exata) return [];
  const q1 = sql(exata, p);
  const r1 = await client.query(q1.texto, q1.params);
  if (r1.rows.length > 0) return r1.rows;

  // Nada encontrado: tolera erro de digitação nas palavras ("alavamca fiat").
  const temPalavras = p.campo === 'aplicacao' && !p.termo.split('|')[0].includes('%');
  if (!temPalavras) return [];
  const aprox = montar(p, true);
  if (!aprox) return [];
  const q2 = sql(aprox, p);
  // Limite padrão (0,6) não pega um erro de letra em palavra curta ("ALAVAMCA" ≈ 0,56).
  // Só nesta consulta; a conexão volta para o pool, então restaura em seguida.
  await client.query(`SET pg_trgm.word_similarity_threshold = ${LIMITE_APROXIMADO}`);
  try {
    const r2 = await client.query(q2.texto, q2.params);
    return r2.rows.map((r: any) => ({ ...r, busca_aproximada: true }));
  } finally {
    await client.query('RESET pg_trgm.word_similarity_threshold').catch(() => {});
  }
}
