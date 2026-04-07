import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERRO: Filial não informada no cookie.');
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  let client: PoolClient | undefined;
  const { descricao, PRVENDA } = req.body;

  // Regra original: TIPOPRECO obrigatório
  const tipoCliente = PRVENDA ? String(PRVENDA) : '0';

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const termo = String(descricao ?? '').trim();
    const like = `${termo}`;

    // ====== CONSULTA PRINCIPAL COM KICKBACK E CONVERSÃO DE DÓLAR ======
    const querySql = `
      SELECT
          p.ref,
          p.codgpe,
          p.codprod,
          p.descr,
          p.qtest,
          (p.qtest - p.qtdreservada) AS qtddisponivel,
          p.dolar,
          m.descr "MARCA",
          CASE
            WHEN kb.dscbalcao45 IS NOT NULL AND kb.dscbalcao45 > 0
            THEN ROUND(
              kb.dscbalcao45 *
              CASE
                WHEN p.dolar = 'S' THEN COALESCE(p.txdolarcompra, 1)
                ELSE 1
              END,
              2
            )
            ELSE ROUND(
              fp."PRECOVENDA" *
              CASE
                WHEN p.dolar = 'S' THEN COALESCE(p.txdolarcompra, 1)
                ELSE 1
              END,
              2
            )
          END AS "PRECOVENDA",
          CASE
            WHEN kb.dscbalcao45 IS NOT NULL AND kb.dscbalcao45 > 0
            THEN 'kickback'
            ELSE 'normal'
          END AS "TIPO_PRECO"
      FROM dbprod p
      JOIN DBMARCAS m ON m.codmarca = p.codmarca
      LEFT JOIN dbprecokb kb ON p.codprod = kb.codprod
      -- evita varchar=bigint
      LEFT JOIN dbformacaoprvenda fp ON btrim(p.codprod::text) = btrim(fp."CODPROD"::text)
        AND fp."TIPOPRECO"::text = $2::text
      WHERE (
          fp."PRECOVENDA" > 0
          OR (kb.dscbalcao45 IS NOT NULL AND kb.dscbalcao45 > 0)
        )
        AND (
          p.descr ILIKE $1
          OR p.ref ILIKE $1
          OR p.codprod::text ILIKE $1
        )
      ORDER BY
        CASE WHEN kb.dscbalcao45 IS NOT NULL AND kb.dscbalcao45 > 0 THEN 0 ELSE 1 END,
        qtddisponivel DESC;
    `;

    const params = [like, tipoCliente];

    const COM_VENDA_Result = await client.query(querySql, params);
    const rows = COM_VENDA_Result.rows;

    // ====== DIAGNÓSTICO OPCIONAL COM KICKBACK (DEV) ======
    // Se não retornou nada e o termo é número (ex.: 418619), mostra no console
    // se o produto existe e se há preço kickback ou preço normal para o TIPOPRECO solicitado.
    if (
      rows.length === 0 &&
      /^\d+$/.test(termo) &&
      process.env.NODE_ENV !== 'production'
    ) {
      const diag = await client.query(
        `
        SELECT
          EXISTS(SELECT 1 FROM dbprod p WHERE p.codprod::text = $1) AS has_prod,
          EXISTS(
            SELECT 1 FROM dbprecokb kb WHERE kb.codprod::text = $1 AND kb.dscbalcao45 > 0
          ) AS has_kickback,
          EXISTS(
            SELECT 1 FROM dbformacaoprvenda fp
            WHERE fp."CODPROD"::text = $1
              AND fp."TIPOPRECO"::text = $2::text
              AND fp."PRECOVENDA" > 0
          ) AS has_price
        `,
        [termo, tipoCliente],
      );
      const d = diag.rows?.[0];
      console.warn('[DIAG PRODUTO COM KICKBACK]', {
        cod: termo,
        tipopreco: tipoCliente,
        ...d,
      });
    }

    // Normaliza colunas para CAIXA ALTA
    let COM_VENDA_Formatado = rows.map((item) => {
      const formattedItem: { [key: string]: any } = {};
      for (const key in item) {
        if (Object.prototype.hasOwnProperty.call(item, key)) {
          formattedItem[key.toUpperCase()] = item[key];
        }
      }
      return serializeBigInt(formattedItem);
    });

    // ====== PROMOÇÕES ATIVAS (inalterado) ======
    if (tipoCliente !== '0') {
      const currentDateTime = new Date().toISOString();

      const queryPromocaoSql = `
        SELECT
            dpi.id_promocao_item,
            dpi.codprod,
            dpi.codgpp,
            dpi.valor_desconto_item,
            dpi.tipo_desconto_item,
            dpi.qtde_minima_item,
            dpi.qtde_maxima_item,
            dpi.qtd_total_item,
            dpi.qtdvendido,
            dpi.qtdfaturado,
            dp.id_promocao,
            dp.ativa,
            dp.nome_promocao,
            dp.tipo_promocao,
            dp.valor_desconto AS valor_desconto_promocao_geral,
            dp.tipo_desconto AS tipo_desconto_promocao_geral
        FROM dbpromocao_item dpi
        JOIN dbpromocao dp ON dpi.id_promocao = dp.id_promocao
        WHERE dp.ativa = TRUE
          AND $1 BETWEEN dp.data_inicio AND dp.data_fim;
      `;

      const promocaoResult = await client.query(queryPromocaoSql, [
        currentDateTime,
      ]);
      const promocoesAtivas = promocaoResult.rows.map((item) =>
        serializeBigInt(item),
      );

      const promocoesMap = new Map<string, any[]>();
      promocoesAtivas.forEach((promo) => {
        const key = promo.codprod != null ? String(promo.codprod) : null;
        if (key) {
          if (!promocoesMap.has(key)) promocoesMap.set(key, []);
          promocoesMap.get(key)!.push(promo);
        }
      });

      COM_VENDA_Formatado = COM_VENDA_Formatado.map((produto) => {
        const codProdKey =
          produto.CODPROD != null ? String(produto.CODPROD) : null;
        if (codProdKey && promocoesMap.has(codProdKey)) {
          return { ...produto, PROMOCOES_ATIVAS: promocoesMap.get(codProdKey) };
        }
        return produto;
      });
    }

    res.status(200).json(COM_VENDA_Formatado);
  } catch (error) {
    console.error('ERRO INESPERADO no API Route:', error);
    res.status(500).json({ error: 'Erro ao buscar dados do produto' });
  } finally {
    if (client) {
      client.release();
    }
  }
}
