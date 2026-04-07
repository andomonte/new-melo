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
                       'id_promocao_item',  sub.id_promocao_item,
                       'id_promocao',       sub.id_promocao,
                       'codigo',            sub.codigo,
                       'descricao',         sub.descricao,
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
                       'prvenda',             sub.prvenda
                     )
                     ORDER BY sub.id_promocao_item
                   )
            FROM (
              -- Dedup da linha do item + joins que podem multiplicar (preço)
              SELECT DISTINCT ON (pi.id_promocao_item)
                     pi.id_promocao_item,
                     pi.id_promocao,
                     COALESCE(pi.codprod::text, pi.codgpp::text) AS codigo,
                     COALESCE(dp.descr, dg.descr)                AS descricao,
                     pi.valor_desconto_item,
                     pi.tipo_desconto_item,
                     pi.qtde_minima_item,
                     pi.qtde_maxima_item,
                     pi.qtdVendido,
                     pi.qtdFaturado,
                     pi.qtd_total_item,
                     pi.origem,
                     cp."MARCA"                                   AS marca,
                     (dp.qtest - dp.qtdreservada)                 AS qtddisponivel,
                     fp1."PRECOVENDA"                             AS prvenda
              FROM dbpromocao_item pi
              LEFT JOIN dbprod    dp ON dp.codprod = pi.codprod
              LEFT JOIN dbgpprod  dg ON dg.codgpp  = pi.codgpp
              LEFT JOIN cmp_produto cp ON cp."CODPROD" = pi.codprod
              LEFT JOIN (
                -- Dedup de preços: 1 linha por (CODPROD, TIPOPRECO)
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
