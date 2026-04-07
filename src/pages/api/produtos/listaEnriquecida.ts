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

    // Adicionar termo de busca geral (productSearch)
    if (searchTerm) {
      const isNumericSearch = /^\d+$/.test(searchTerm);
      if (isNumericSearch) {
        whereConditions.push(
          `(p.descr ILIKE $${paramIndex} OR p.ref ILIKE $${
            paramIndex + 1
          } OR p.codprod = $${paramIndex + 2})`,
        );
        params.push(`%${searchTerm}%`);
        params.push(`%${searchTerm}%`);
        params.push(searchTerm);
        paramIndex += 3;
      } else {
        whereConditions.push(
          `(p.descr ILIKE $${paramIndex} OR p.ref ILIKE $${paramIndex + 1})`,
        );
        params.push(`%${searchTerm}%`);
        params.push(`%${searchTerm}%`);
        paramIndex += 2;
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
          p.descr AS descr,
          p.qtest AS qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel,
          p.dolar AS dolar,
          cp_filtered."MARCA" AS codmarca,
          fp_filtered.prvenda AS prvenda
      FROM dbprod p
      JOIN (
          -- Seleciona uma única marca por CODPROD de cmp_produto
          -- Prioriza 'ARTEB' ou a primeira marca em ordem alfabética se não for ARTEB
          SELECT DISTINCT ON ("CODPROD")
              "CODPROD",
              "MARCA"
          FROM cmp_produto
          ORDER BY "CODPROD",
                   CASE WHEN "MARCA" = 'ARTEB' THEN 0 ELSE 1 END, -- Prioriza 'ARTEB'
                   "MARCA" -- Desempate alfabético para outras marcas
      ) cp_filtered ON p.codprod = cp_filtered."CODPROD"
      JOIN (
          -- Seleciona um único preço por CODPROD e TIPOPRECO de dbformacaoprvenda
          -- Prioriza a linha que tem o maior PRECOVENDA, ou outro critério se houver
          SELECT DISTINCT ON ("CODPROD", "TIPOPRECO")
              "CODPROD",
              "PRECOVENDA" AS prvenda,
              "TIPOPRECO"
          FROM dbformacaoprvenda
          WHERE "PRECOVENDA" > 0 -- Mantém a condição de preço > 0 aqui
            AND "TIPOPRECO" = $${paramIndex} -- Filtra o tipo de preço aqui
          ORDER BY "CODPROD", "TIPOPRECO",
                   "PRECOVENDA" DESC -- Desempate: se houver múltiplos preços para o mesmo CODPROD/TIPOPRECO, pega o maior
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
              "CODPROD"
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
            AND "TIPOPRECO" = $${tipoClienteParamIndex} -- Referencia o parâmetro tipoCliente
          ORDER BY "CODPROD", "TIPOPRECO",
                   "PRECOVENDA" DESC
      ) fp_filtered ON p.codprod = fp_filtered."CODPROD"
      ${finalWhereClause};
    `;

    const countQueryParams = params.slice(0, params.length - 2); // Remove LIMIT e OFFSET

    const [dataResult, countResult] = await Promise.all([
      client.query(dataQuerySql, params),
      client.query(countQuerySql, countQueryParams),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);
    const products = dataResult.rows;

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
