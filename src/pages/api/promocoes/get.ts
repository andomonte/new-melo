// src/pages/api/promocoes/get-with-items.ts (ou o caminho que você usa)

import { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';
import { parseCookies } from 'nookies';

interface GetParams {
  page?: string;
  perPage?: string;
  search?: string; // filtro por nome_promocao
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido. Use GET.' });
  }

  const { page = '1', perPage = '10', search = '' } = req.query as GetParams;
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const pageNumber = parseInt(String(page), 10);
    const perPageNumber = parseInt(String(perPage), 10);
    const offset = (pageNumber - 1) * perPageNumber;
    const searchTerm = `%${String(search ?? '')}%`;

    // TIPOPRECO fixo '0' como no seu código atual (ajuste se precisar vir da query)
    const tipoPreco = '0';

    const promocoesResult = await client.query(
      `
      SELECT
        p.id_promocao,
        p.nome_promocao,
        p.descricao_promocao,
        p.data_inicio,
        p.data_fim,
        p.tipo_promocao,
        p.valor_desconto,
        p.tipo_desconto,
        p.qtde_minima_ativacao,
        p.qtde_maxima_total,
        p.qtde_maxima_por_cliente,
        p.ativa,
        p.criado_em,
        p.criado_por,
        p.observacoes,
        COALESCE(
          (
            SELECT jsonb_agg(
                     jsonb_build_object(
                       'id_promocao_item',    sub.id_promocao_item,
                       'id_promocao',         sub.id_promocao,
                       'codprod',             sub.codprod_raw,
                       'codigo',              sub.codigo,
                       'codgpp',              sub.codgpp_raw,
                       'descricao',           sub.descricao,
                       'ref',                 sub.ref,
                       'valor_desconto_item', sub.valor_desconto_item,
                       'tipo_desconto_item',  sub.tipo_desconto_item,
                       'qtde_minima_item',    sub.qtde_minima_item,
                       'qtde_maxima_item',    sub.qtde_maxima_item,
                       'qtdVendido',          sub.qtdVendido,
                       'qtdFaturado',         sub.qtdFaturado,
                       'qtd_total_item',      sub.qtd_total_item,
                       'origem',              sub.origem,
                       'marca',               sub.marca,
                       'qtddisponivel',       sub.qtddisponivel,
                       'prvenda',             sub.prvenda,
                       'prcompra',            sub.prcompra,
                       'prcustoatual',        sub.prcustoatual,
                       'preco_promocao',      sub.preco_promocao,
                       'margem_custo_compra', sub.margem_custo_compra,
                       'margem_custo_medio',  sub.margem_custo_medio,
                       'margem_tabela',       sub.margem_tabela,
                       'qtd_vendida_fora',    sub.qtd_vendida_fora,
                       'qtd_faturada_fora',   sub.qtd_faturada_fora
                     )
                     ORDER BY sub.id_promocao_item
                   )
            FROM (
              SELECT DISTINCT ON (pi.id_promocao_item)
                     pi.id_promocao_item,
                     pi.id_promocao,
                     pi.codprod                                    AS codprod_raw,
                     pi.codgpp                                     AS codgpp_raw,
                     COALESCE(pi.codprod::text, pi.codgpp::text)   AS codigo,
                     COALESCE(dp.descr, dg.descr)                  AS descricao,
                     dp.ref                                        AS ref,
                     pi.valor_desconto_item,
                     pi.tipo_desconto_item,
                     pi.qtde_minima_item,
                     pi.qtde_maxima_item,
                     pi.qtdVendido,
                     pi.qtdFaturado,
                     pi.qtd_total_item,
                     pi.origem,
                     cp."MARCA"                                    AS marca,
                     (COALESCE(dp.qtest, 0) - COALESCE(dp.qtdreservada, 0)) AS qtddisponivel,
                     fp1."PRECOVENDA"                              AS prvenda,
                     COALESCE(dp.prcompra, 0)                      AS prcompra,
                     COALESCE(dp.prcustoatual, 0)                  AS prcustoatual,
                     -- Preço com promoção aplicada
                     CASE
                       WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PERC'
                         THEN fp1."PRECOVENDA" * (1 - COALESCE(pi.valor_desconto_item, p.valor_desconto) / 100)
                       WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'VALO'
                         THEN fp1."PRECOVENDA" - COALESCE(pi.valor_desconto_item, p.valor_desconto)
                       WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PREF'
                         THEN COALESCE(pi.valor_desconto_item, p.valor_desconto)
                       ELSE fp1."PRECOVENDA"
                     END                                           AS preco_promocao,
                     -- Margem custo compra: ((precoPromo / prcompra) - 1) * 100
                     CASE WHEN COALESCE(dp.prcompra, 0) > 0 THEN
                       ROUND(((
                         CASE
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PERC'
                             THEN fp1."PRECOVENDA" * (1 - COALESCE(pi.valor_desconto_item, p.valor_desconto) / 100)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'VALO'
                             THEN fp1."PRECOVENDA" - COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PREF'
                             THEN COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           ELSE fp1."PRECOVENDA"
                         END
                       ) / dp.prcompra - 1) * 100, 2)
                     ELSE 0 END                                    AS margem_custo_compra,
                     -- Margem custo médio: ((precoPromo / prcustoatual) - 1) * 100
                     CASE WHEN COALESCE(dp.prcustoatual, 0) > 0 THEN
                       ROUND(((
                         CASE
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PERC'
                             THEN fp1."PRECOVENDA" * (1 - COALESCE(pi.valor_desconto_item, p.valor_desconto) / 100)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'VALO'
                             THEN fp1."PRECOVENDA" - COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PREF'
                             THEN COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           ELSE fp1."PRECOVENDA"
                         END
                       ) / dp.prcustoatual - 1) * 100, 2)
                     ELSE
                       -- Fallback: se prcustoatual = 0, usa prcompra (igual Delphi)
                       CASE WHEN COALESCE(dp.prcompra, 0) > 0 THEN
                         ROUND(((
                           CASE
                             WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PERC'
                               THEN fp1."PRECOVENDA" * (1 - COALESCE(pi.valor_desconto_item, p.valor_desconto) / 100)
                             WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'VALO'
                               THEN fp1."PRECOVENDA" - COALESCE(pi.valor_desconto_item, p.valor_desconto)
                             WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PREF'
                               THEN COALESCE(pi.valor_desconto_item, p.valor_desconto)
                             ELSE fp1."PRECOVENDA"
                           END
                         ) / dp.prcompra - 1) * 100, 2)
                       ELSE 0 END
                     END                                           AS margem_custo_medio,
                     -- Margem sobre tabela: ((precoPromo / prvenda) - 1) * 100
                     CASE WHEN COALESCE(fp1."PRECOVENDA", 0) > 0 THEN
                       ROUND(((
                         CASE
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PERC'
                             THEN fp1."PRECOVENDA" * (1 - COALESCE(pi.valor_desconto_item, p.valor_desconto) / 100)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'VALO'
                             THEN fp1."PRECOVENDA" - COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           WHEN COALESCE(pi.tipo_desconto_item, p.tipo_desconto) = 'PREF'
                             THEN COALESCE(pi.valor_desconto_item, p.valor_desconto)
                           ELSE fp1."PRECOVENDA"
                         END
                       ) / fp1."PRECOVENDA" - 1) * 100, 2)
                     ELSE 0 END                                    AS margem_tabela,
                     -- Qtd vendida TOTAL do item no período da promoção
                     -- (vendas fora = total - vendido na promoção)
                     GREATEST(
                       COALESCE((
                         SELECT SUM(iv.qtd)
                         FROM dbitvenda iv
                         INNER JOIN dbvenda v ON v.codvenda = iv.codvenda
                         WHERE iv.codprod = pi.codprod
                           AND v.data >= p2.data_inicio
                           AND v.data <= p2.data_fim
                           AND COALESCE(v.cancel, 'N') != 'S'
                       ), 0) - COALESCE(pi.qtdVendido, 0),
                     0)                                            AS qtd_vendida_fora,
                     -- Qtd faturada FORA da promoção no período
                     -- (total faturado do item no período - faturado na promoção)
                     GREATEST(
                       COALESCE((
                         SELECT SUM(iv2.qtd)
                         FROM dbitvenda iv2
                         INNER JOIN dbvenda v2 ON v2.codvenda = iv2.codvenda
                         INNER JOIN fatura_venda fv2 ON fv2.codvenda = v2.codvenda
                         INNER JOIN dbfatura f2 ON f2.codfat = fv2.codfat
                         WHERE iv2.codprod = pi.codprod
                           AND f2.data >= p2.data_inicio
                           AND f2.data <= p2.data_fim
                       ), 0) - COALESCE(pi.qtdFaturado, 0),
                     0)                                            AS qtd_faturada_fora
              FROM dbpromocao_item pi
              INNER JOIN dbpromocao p2 ON p2.id_promocao = pi.id_promocao
              LEFT JOIN dbprod    dp ON dp.codprod = pi.codprod
              LEFT JOIN dbgpprod  dg ON dg.codgpp  = pi.codgpp
              LEFT JOIN cmp_produto cp ON cp."CODPROD" = pi.codprod
              LEFT JOIN (
                SELECT DISTINCT ON ("CODPROD", "TIPOPRECO")
                       "CODPROD", "TIPOPRECO", "PRECOVENDA"
                FROM dbformacaoprvenda
                WHERE "TIPOPRECO" = $2
                  AND "PRECOVENDA" > 0
                ORDER BY "CODPROD", "TIPOPRECO", "PRECOVENDA" DESC
              ) fp1 ON fp1."CODPROD" = pi.codprod
              WHERE pi.id_promocao = p.id_promocao
              ORDER BY pi.id_promocao_item, fp1."PRECOVENDA" DESC NULLS LAST
            ) AS sub
          ),
          '[]'::jsonb
        ) AS itens_promocao
      FROM dbpromocao p
      WHERE p.nome_promocao ILIKE $1
        AND p.ativa = TRUE
      ORDER BY p.id_promocao DESC
      OFFSET $3
      LIMIT  $4
      `,
      [searchTerm, tipoPreco, offset, perPageNumber],
    );

    const countResult = await client.query(
      `
      SELECT COUNT(*) AS total
      FROM dbpromocao
      WHERE nome_promocao ILIKE $1
        AND ativa = TRUE
      `,
      [searchTerm],
    );

    const total = parseInt(countResult.rows[0].total, 10) || 0;

    res.status(200).json({
      data: promocoesResult.rows.map((row) => serializeBigInt(row)),
      meta: {
        total,
        lastPage: total > 0 ? Math.ceil(total / perPageNumber) : 1,
        currentPage: total > 0 ? pageNumber : 1,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar promoções com itens:', error);
    res
      .status(500)
      .json({ error: 'Erro interno ao buscar promoções com itens' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
