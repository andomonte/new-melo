// src/pages/api/produtos/listaEnriquecida.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

// Mapeamento das colunas do frontend para as colunas SQL para o produto
const filtroParaColunaSQL: Record<string, string> = {
  ref: 'p.ref',
  codgpf: 'p.codgpe',
  codprod: 'p.codprod',
  descr: 'p.descr',
  qtest: 'p.qtest',
  qtddisponivel: '(p.qtest - p.qtdreservada)',
  dolar: 'p.dolar',
  codmarca: 'cp_filtered."MARCA"', // Referencia o alias da CTE
  prvenda: 'fp_filtered.prvenda', // Referencia o alias da CTE
};

export default async function listaProdutosEnriquecida(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: Filial não informada no cookie.');
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const {
    page = 1,
    perPage = 10,
    productSearch = '',
    tipoPreco = '0',
    filtros = [],
  } = req.body;

  const currentPage = parseInt(String(page), 10);
  const itemsPerPage = parseInt(String(perPage), 10);
  const searchTerm = String(productSearch);
  const tipoCliente = String(tipoPreco);

  if (isNaN(currentPage) || currentPage < 1) {
    return res.status(400).json({ error: 'Parâmetro "page" inválido.' });
  }
  if (isNaN(itemsPerPage) || itemsPerPage < 1) {
    return res.status(400).json({ error: 'Parâmetro "perPage" inválido.' });
  }

  const offset = (currentPage - 1) * itemsPerPage;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const params: any[] = [];
    const whereConditions: string[] = [];
    let paramIndex = 1;

    // Condições padrão da sua query original
    // fp_filtered agora virá da CTE, então aplicamos o filtro nela.
    // O tipoPreco agora é filtrado DENTRO da CTE fp_filtered para garantir que o DISTINCT ON funcione corretamente
    // e selecione o preço certo ANTES do JOIN.
    // A condição "PRECOVENDA > 0" também será aplicada dentro da CTE.

    // Busca geral com regras:
    // espaço = AND | ; ou , = OR | | = marca | % na frente = contém
    if (searchTerm) {
      // Detecta tipo de busca pra otimizar colunas
      const parteAntesPipe = String(searchTerm).split('|')[0].trim();
      const isNumerico = /^\d+$/.test(parteAntesPipe);
      const isRefMista = /^[A-Za-z]+\d+/.test(parteAntesPipe) || /^\d+[A-Za-z]+/.test(parteAntesPipe);
      const colsGeral = isNumerico
        ? ['p.codprod::text', 'p.ref']
        : isRefMista
          ? ['p.ref', 'p.codprod::text']
          : ['p.aplic_extendida', 'p.ref'];
      const colMarca = 'cp_filtered."MARCA"';

      // Separa parte geral e parte marca pelo |
      const partes = String(searchTerm).split('|');
      const parteGeral = (partes[0] || '').trim();
      const parteMarca = (partes[1] || '').trim();

      // Função: montar condição para um termo em colunas específicas
      const montarTermoCond = (termo: string, colunas: string[]): string => {
        const contemMode = termo.startsWith('%');
        const termoLimpo = termo.replace(/^%+|%+$/g, '').trim();
        if (!termoLimpo) return '';
        const like = contemMode ? `%${termoLimpo}%` : `${termoLimpo}%`;
        const colConds = colunas.map((col) => `${col} ILIKE $${paramIndex}`);
        params.push(like);
        paramIndex++;
        return `(${colConds.join(' OR ')})`;
      };

      // Função: montar grupo OR (separado por ; ou ,) com AND interno (espaço)
      // Aspas = frase exata: "mola grande" busca a frase completa como prefixo
      const montarGrupos = (input: string, colunas: string[]): string => {
        // Extrair frases entre aspas antes de splitar
        const frases: string[] = [];
        const semAspas = input.replace(/"([^"]+)"/g, (_match, frase) => {
          frases.push(frase.trim());
          return '';
        }).trim();

        const grupos = semAspas
          .split(/[;,]/)
          .map((g) => g.trim().split(/\s+/).filter(Boolean))
          .filter((g) => g.length > 0);

        // Adicionar frases exatas como grupos de uma palavra só (prefixo da frase)
        frases.forEach((f) => {
          if (f) grupos.push([f]);
        });

        if (grupos.length === 0) return '';

        const orConds = grupos.map((termos) => {
          if (termos.length === 1) {
            return montarTermoCond(termos[0], colunas);
          } else {
            // Múltiplas palavras: busca só em aplic_extendida (texto descritivo)
            // Primeira = prefixo, demais = contém
            const colTexto = ['p.aplic_extendida'];
            const andConds = termos.map((t, i) => {
              const temPercent = t.startsWith('%');
              const termoLimpo = t.replace(/^%+|%+$/g, '').trim();
              if (!termoLimpo) return '';
              const like = temPercent ? `%${termoLimpo}%` : (i === 0 ? `${termoLimpo}%` : `%${termoLimpo}%`);
              const colConds = colTexto.map((col) => `${col} ILIKE $${paramIndex}`);
              params.push(like);
              paramIndex++;
              return `(${colConds.join(' OR ')})`;
            }).filter(Boolean);
            return andConds.length > 1 ? `(${andConds.join(' AND ')})` : andConds[0] || '';
          }
        }).filter(Boolean);

        if (orConds.length === 0) return '';
        return orConds.length > 1 ? `(${orConds.join(' OR ')})` : orConds[0];
      };

      const condicoes: string[] = [];

      // Parte geral (antes do |)
      if (parteGeral) {
        const cond = montarGrupos(parteGeral, colsGeral);
        if (cond) condicoes.push(cond);
      }

      // Parte marca (depois do |)
      if (parteMarca) {
        const cond = montarGrupos(parteMarca, [colMarca]);
        if (cond) condicoes.push(cond);
      }

      if (condicoes.length > 0) {
        whereConditions.push(condicoes.length > 1 ? `(${condicoes.join(' AND ')})` : condicoes[0]);
      }
    }

    const filtrosAgrupados: Record<string, { tipo: string; valor: string }[]> =
      {};

    filtros.forEach(
      (filtro: { campo: string; tipo: string; valor: string }) => {
        if (!filtroParaColunaSQL[filtro.campo]) {
          console.warn(
            `Campo de filtro desconhecido ou não mapeado para SQL: ${filtro.campo}`,
          );
          return;
        }
        if (!filtrosAgrupados[filtro.campo]) {
          filtrosAgrupados[filtro.campo] = [];
        }
        filtrosAgrupados[filtro.campo].push(filtro);
      },
    );

    Object.entries(filtrosAgrupados).forEach(([campo, filtrosDoCampo]) => {
      const colunaSQL = filtroParaColunaSQL[campo];
      if (!colunaSQL) return;

      const campoConditions: string[] = [];
      filtrosDoCampo.forEach((filtro) => {
        let operador = 'ILIKE';
        let valor = String(filtro.valor);

        switch (filtro.tipo) {
          case 'igual':
            operador = '=';
            break;
          case 'diferente':
            operador = '<>';
            break;
          case 'maior':
            operador = '>';
            break;
          case 'maior_igual':
            operador = '>=';
            break;
          case 'menor':
            operador = '<';
            break;
          case 'menor_igual':
            operador = '<=';
            break;
          case 'contém':
            valor = `%${valor}%`;
            break;
          case 'começa':
            valor = `${valor}%`;
            break;
          case 'termina':
            valor = `%${valor}`;
            break;
          case 'nulo':
            campoConditions.push(`${colunaSQL} IS NULL`);
            return;
          case 'nao_nulo':
            campoConditions.push(`${colunaSQL} IS NOT NULL`);
            return;
          default:
            return;
        }
        campoConditions.push(`${colunaSQL} ${operador} $${paramIndex++}`);
        params.push(valor);
      });

      if (campoConditions.length > 0) {
        whereConditions.push(`(${campoConditions.join(' OR ')})`);
      }
    });

    const finalWhereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const dataQuerySql = `
      SELECT
          p.ref AS ref,
          p.codgpe AS codgpf,
          p.codprod AS codprod,
          COALESCE(p.aplic_extendida, p.descr) AS descr,
          p.qtest AS qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel,
          p.dolar AS dolar,
          COALESCE(p.prcompra, 0) AS prcompra,
          COALESCE(p.prcustoatual, 0) AS prcustoatual,
          cp_filtered."MARCA" AS codmarca,
          fp_filtered.prvenda AS prvenda
      FROM dbprod p
      JOIN (
          SELECT DISTINCT ON ("CODPROD")
              "CODPROD",
              "MARCA"
          FROM cmp_produto
          ORDER BY "CODPROD",
                   CASE WHEN "MARCA" = 'ARTEB' THEN 0 ELSE 1 END,
                   "MARCA"
      ) cp_filtered ON p.codprod = cp_filtered."CODPROD"
      JOIN (
          SELECT DISTINCT ON ("CODPROD", "TIPOPRECO")
              "CODPROD",
              "PRECOVENDA" AS prvenda,
              "TIPOPRECO"
          FROM dbformacaoprvenda
          WHERE "PRECOVENDA" > 0
            AND "TIPOPRECO" = $${paramIndex}
          ORDER BY "CODPROD", "TIPOPRECO",
                   "PRECOVENDA" DESC
      ) fp_filtered ON p.codprod = fp_filtered."CODPROD"
      ${finalWhereClause}
      ORDER BY qtddisponivel DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2};
    `;

    // Adiciona o parâmetro tipoCliente para o filtro dentro da CTE fp_filtered
    // O paramIndex já foi incrementado para o tipoCliente, então não precisa aqui
    // params.push(tipoCliente); // Já foi adicionado acima, no início, agora deve ser o paramIndex
    const tipoClienteParamIndex = paramIndex; // Guarda o índice do tipoCliente para usar na CTE
    params.splice(paramIndex, 0, tipoCliente); // Insere o tipoCliente no local correto para o $${paramIndex} da CTE

    // Ajusta os paramIndex para LIMIT e OFFSET
    paramIndex += 1; // Para o tipoCliente que foi inserido
    params.push(itemsPerPage);
    params.push(offset);

    const countQuerySql = `
      SELECT COUNT(*)
      FROM dbprod p
      JOIN (
          SELECT DISTINCT ON ("CODPROD")
              "CODPROD",
              "MARCA"
          FROM cmp_produto
          ORDER BY "CODPROD",
                   CASE WHEN "MARCA" = 'ARTEB' THEN 0 ELSE 1 END,
                   "MARCA"
      ) cp_filtered ON p.codprod = cp_filtered."CODPROD"
      JOIN (
          SELECT DISTINCT ON ("CODPROD", "TIPOPRECO")
              "CODPROD",
              "PRECOVENDA",
              "TIPOPRECO"
          FROM dbformacaoprvenda
          WHERE "PRECOVENDA" > 0
            AND "TIPOPRECO" = $${tipoClienteParamIndex}
          ORDER BY "CODPROD", "TIPOPRECO",
                   "PRECOVENDA" DESC
      ) fp_filtered ON p.codprod = fp_filtered."CODPROD"
      ${finalWhereClause};
    `;

    // Busca dados primeiro, count só se tiver resultados (performance)
    const dataResult = await client.query(dataQuerySql, params);
    const products = dataResult.rows;

    let total = products.length;
    if (products.length >= itemsPerPage) {
      // Só roda count se a página está cheia (pode ter mais)
      const countQueryParams = params.slice(0, params.length - 2);
      const countResult = await client.query(countQuerySql, countQueryParams);
      total = parseInt(countResult.rows[0].count, 10);
    }

    const lastPage = Math.ceil(total / itemsPerPage);

    res.status(200).json({
      data: serializeBigInt(products),
      meta: {
        total: total,
        lastPage: lastPage,
        currentPage: currentPage,
        perPage: itemsPerPage,
      },
    });
  } catch (error) {
    console.error('ERRO no API Route (listaEnriquecida):', error);
    res
      .status(500)
      .json({ error: 'Erro ao buscar dados dos produtos paginados.' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
