import { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

interface requestBodyDTO {
  descricao?: string;
  PRVENDA?: string | number;
  armId?: string | number;
  arm_id?: string | number;
}

const baseQuery = `
      WITH
      /* 1) Colapsa estoque do armazém: 1 linha por produto */
      cap_sum AS (
        SELECT
          btrim(arp_codprod) AS codprod_txt,
          SUM(arp_qtest)            AS qtest,
          SUM(arp_qtest_reservada)  AS qtdreservada
        FROM cad_armazem_produto
        WHERE COALESCE(arp_bloqueado,'N') <> 'S'
          AND arp_arm_id = $3
        GROUP BY btrim(arp_codprod)
      ),

      /* 2) Colapsa preço: 1 linha por (CODPROD, TIPOPRECO) */
      fp_collapse AS (
        SELECT "CODPROD",
               "TIPOPRECO",
               MAX("PRECOVENDA") AS "PRECOVENDA"
        FROM dbformacaoprvenda
        WHERE "TIPOPRECO"::text = $2::text
          AND "PRECOVENDA" > 0
        GROUP BY "CODPROD","TIPOPRECO"
      ),

      /* 3) Garante 1-para-1 em dbgpprod -> codseg */
      gpp_one AS (
        SELECT DISTINCT ON (btrim(gpp.codgpp::text))
               btrim(gpp.codgpp::text) AS codgpp_txt,
               btrim(gpp.codseg::text) AS codseg_txt
        FROM dbgpprod gpp
        ORDER BY btrim(gpp.codgpp::text), btrim(gpp.codseg::text)
      ),

      /* 4) Preços de Kickback: busca da tabela dbprecokb */
      kb_precos AS (
        SELECT
          btrim(codprod::text) AS codprod_txt,
          dscbalcao45 AS preco_kickback
        FROM dbprecokb
        WHERE dscbalcao45 IS NOT NULL AND dscbalcao45 > 0
      )

      SELECT
        p.ref,
        p.codgpe AS "CODGPE",
        p.codprod,
        p.aplic_extendida AS descr,
        COALESCE(cs.qtest, 0) AS qtest,
        COALESCE(cs.qtdreservada, 0) AS qtdreservada,
        COALESCE(cs.qtest, 0) - COALESCE(cs.qtdreservada, 0) AS qtddisponivel,
        p.dolar,
        m.descr AS "MARCA",
        fp."PRECOVENDA",
        /* Preço de Kickback (se existir) */
        kb.preco_kickback AS "PRECO_KICKBACK",
        /* margens via segmento */
        seg.margem_min_venda AS margem_min_venda,
        seg.margem_med_venda AS margem_med_venda,
        seg.margem_ide_venda AS margem_ide_venda
      FROM dbprod p
      /* Estoque 1:1 */
      JOIN cap_sum cs
        ON cs.codprod_txt = btrim(p.codprod::text)
      /* Marca */
      JOIN dbmarcas m
        ON m.codmarca = p.codmarca
      /* Preço 1:1 por (CODPROD, TIPOPRECO) */
      LEFT JOIN fp_collapse fp
        ON btrim(p.codprod::text) = btrim(fp."CODPROD"::text)
       AND fp."TIPOPRECO"::text = $2::text
      /* Preço Kickback 1:1 */
      LEFT JOIN kb_precos kb
        ON kb.codprod_txt = btrim(p.codprod::text)
      /* Grupo/segmento 1:1 */
      LEFT JOIN gpp_one gpp
        ON gpp.codgpp_txt = btrim(p.codgpp::text)
      LEFT JOIN dbsegmento seg
        ON seg.codseg::text = gpp.codseg_txt

      WHERE fp."PRECOVENDA" IS NOT NULL
       AND COALESCE(p.inf, '') <> 'D'          -- << NOVO
       AND COALESCE(p.excluido, 0) <> 1
        AND (
          p.aplic_extendida ILIKE $1
          OR p.ref ILIKE $1
          OR p.codprod::text ILIKE $1
        )
      ORDER BY qtddisponivel DESC;
    `;
const queryPromocao = `
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
export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  let client: PoolClient | undefined;

  if (!filial) {
    console.error('ERRO: Filial não informada no cookie.');
    return res.status(400).json({ error: 'Filial não informada no cookie' });
  }

  const { descricao, PRVENDA, armId, arm_id } = (req.body ??
    {}) as requestBodyDTO;

  // Busca por prefixo (mantido como sua versão nova)
  const termo = String(descricao ?? '').trim();
  const like = `${termo}%`;

  // TIPOPRECO requerido na consulta de preço
  const tipoCliente = PRVENDA != null ? String(PRVENDA) : '0';

  // arm_id obrigatório
  const armRaw = armId ?? arm_id;
  const armStr =
    armRaw !== undefined && armRaw !== null ? String(armRaw).trim() : '';
  if (!armStr) {
    return res.status(400).json({ error: 'Parâmetro arm_id é obrigatório.' });
  }
  const armNum = Number(armStr);
  if (!Number.isFinite(armNum)) {
    return res.status(400).json({ error: 'arm_id inválido.' });
  }

  try {
    const pool = getPgPool(filial);
    client = await pool.connect();

    const params: any[] = [like, tipoCliente, armNum];

    const response = await client.query(baseQuery, params);
    const rows = response.rows;

    // Diagnóstico opcional
    await diagnostico(rows, client);

    // Normaliza colunas para CAIXA ALTA
    let payload = toUpperCaseRows(rows);

    // PROMOÇÕES ATIVAS (inalterado)
    if (tipoCliente !== '0') {
      payload = await promocoesAtivas(payload, client);
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error('ERRO INESPERADO no API Route (PG):', error);
    return res
      .status(500)
      .json({ error: 'Erro ao buscar dados do produto (PG)' });
  } finally {
    if (client) client.release();
  }

  async function promocoesAtivas(payload: any[], clientArg?: PoolClient) {
    const currentDateTime = new Date().toISOString();

    const promocaoResult = await clientArg!.query(queryPromocao, [
      currentDateTime,
    ]);
    const promocoesAtivas = promocaoResult.rows.map((x) => serializeBigInt(x));

    const promocoesMap = new Map<string, any[]>();
    promocoesAtivas.forEach((p) => {
      const key = p.codprod != null ? String(p.codprod) : null;
      if (!key) return;
      if (!promocoesMap.has(key)) promocoesMap.set(key, []);
      promocoesMap.get(key)!.push(p);
    });

    payload = payload.map((produto) => {
      const key = produto.CODPROD != null ? String(produto.CODPROD) : null;
      if (key && promocoesMap.has(key)) {
        return { ...produto, PROMOCOES_ATIVAS: promocoesMap.get(key) };
      }
      return produto;
    });
    return payload;
  }

  async function diagnostico(rows: any[], clientArg?: PoolClient) {
    if (
      rows.length === 0 &&
      /^\d+$/.test(termo) &&
      process.env.NODE_ENV !== 'production'
    ) {
      const diagResponse = await clientArg!.query(
        `
        SELECT
          EXISTS(SELECT 1 FROM dbprod p WHERE p.codprod::text = $1) AS has_prod,
          EXISTS(
            SELECT 1 FROM dbformacaoprvenda fp
            WHERE fp."CODPROD"::text = $1
              AND fp."TIPOPRECO"::text = $2::text
              AND fp."PRECOVENDA" > 0
          ) AS has_price
        `,
        [termo, tipoCliente],
      );
      console.warn('[DIAG PRODUTO PG]', {
        cod: termo,
        tipopreco: tipoCliente,
        ...diagResponse.rows?.[0],
      });
    }
  }

  function toUpperCaseRows(rows: any[]) {
    return rows.map((item) => {
      const formatted: Record<string, any> = {};
      for (const k in item) {
        if (Object.prototype.hasOwnProperty.call(item, k)) {
          formatted[k.toUpperCase()] = item[k];
        }
      }
      return serializeBigInt(formatted);
    });
  }
}
