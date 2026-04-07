import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { Sequelize, QueryTypes } from 'sequelize';
const oracledb = require('oracledb');

/* ------------------------------------------------
 * Logger
 * ----------------------------------------------*/
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
    }
  };
  return { traceId, log, err };
}

/* ------------------------------------------------
 * Oracle via Sequelize
 * ----------------------------------------------*/
let _oraSequelize: any | null = null;
async function getOracleSequelize() {
  if (!_oraSequelize) {
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4',
    });
    if (!process.env.DATABASE_URL2) {
      throw new Error('DATABASE_URL2 ausente para Oracle via Sequelize.');
    }
    _oraSequelize = new Sequelize(process.env.DATABASE_URL2, {
      logging: false,
    });
  }
  return _oraSequelize;
}

/* ------------------------------------------------
 * Helpers
 * ----------------------------------------------*/
function upperKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = (row as any)[k];
  return out;
}

/* ------------------------------------------------
 * Handler
 * ----------------------------------------------*/
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { log, err } = mkLogger('buscarProdutoOracle');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo; // telemetria
  log('filial_melo:', filial || '(vazio)');

  const { descricao, PRVENDA, armId, arm_id } = (req.body || {}) as {
    descricao?: string;
    PRVENDA?: string | number;
    armId?: number | string;
    arm_id?: number | string;
  };

  // termo e LIKE:
  // - vazio => '%'
  // - se usuário usou % ou _, mantemos… MAS se não terminou com %, acrescentamos '%'
  // - se não usou curingas, viramos prefixo: termo%
  const termoRaw = String(descricao ?? '').trim();
  let like: string;
  if (!termoRaw) {
    like = '%';
  } else if (/%|_/.test(termoRaw)) {
    like = termoRaw.endsWith('%') ? termoRaw : `${termoRaw}%`;
  } else {
    like = `${termoRaw}%`;
  }

  // TIPOPRECO obrigatório
  const tipoCliente = PRVENDA != null ? String(PRVENDA) : '0';

  // arm_id obrigatório
  const armRaw = armId ?? arm_id;
  const armStr =
    armRaw !== undefined && armRaw !== null ? String(armRaw).trim() : '';

  if (!armStr) {
    return res
      .status(400)
      .json({ ok: false, error: 'Parâmetro arm_id é obrigatório.' });
  }
  const armNum = Number(armStr);
  if (!Number.isFinite(armNum)) {
    return res.status(400).json({ ok: false, error: 'arm_id inválido.' });
  }

  let ora: any | null = null;

  try {
    ora = await getOracleSequelize();

    // ===== CONSULTA PRINCIPAL (sem duplicidade) =====
    const sql = `
      WITH
      cap_sum AS (
        SELECT
          TRIM(ARP_CODPROD) AS CODPROD_TXT,
          SUM(ARP_QTEST)            AS QTEST,
          SUM(ARP_QTEST_RESERVADA)  AS QTDRESERVADA
        FROM CAD_ARMAZEM_PRODUTO
        WHERE NVL(ARP_BLOQUEADO, 'N') <> 'S'
          AND ARP_ARM_ID = :ARM
        GROUP BY TRIM(ARP_CODPROD)
      ),
      fp_collapse AS (
        SELECT
          CODPROD,
          TIPOPRECO,
          MAX(PRECOVENDA) AS PRECOVENDA
        FROM DBFORMACAOPRVENDA
        WHERE TIPOPRECO = :TIPO
          AND PRECOVENDA > 0
        GROUP BY CODPROD, TIPOPRECO
      )
      SELECT
        p.REF,
        p.CODGPE,
        p.CODPROD,
        p.DESCR,
        NVL(cs.QTEST, 0) AS QTEST,
        NVL(cs.QTDRESERVADA, 0) AS QTDRESERVADA,
        NVL(cs.QTEST, 0) - NVL(cs.QTDRESERVADA, 0) AS QTDDISPONIVEL,
        p.DOLAR,
        m.DESCR AS MARCA,
        fp.PRECOVENDA
      FROM DBPROD p
      /* estoque 1:1 por produto no armazém */
      JOIN cap_sum cs
        ON cs.CODPROD_TXT = TRIM(p.CODPROD)
      /* marca */
      JOIN DBMARCAS m
        ON m.CODMARCA = p.CODMARCA
      /* preço 1:1 por (CODPROD, TIPOPRECO) */
      LEFT JOIN fp_collapse fp
        ON fp.CODPROD = p.CODPROD
       AND fp.TIPOPRECO = :TIPO
      WHERE fp.PRECOVENDA IS NOT NULL
        AND NVL(p.INF, '') <> 'D'
        AND NVL(p.EXCLUIDO, 0) <> 1
        AND (
             UPPER(p.DESCR) LIKE UPPER(:LIKE)
          OR UPPER(p.REF)   LIKE UPPER(:LIKE)
          OR p.CODPROD      LIKE :LIKE
        )
      ORDER BY QTDDISPONIVEL DESC
    `;

    const params = { LIKE: like, TIPO: tipoCliente, ARM: armNum };

    const rows = (await ora.query(sql, {
      replacements: params,
      type: QueryTypes.SELECT,
    })) as any[];

    // Diagnóstico dev-only quando não retorna e termo é numérico
    if (rows.length === 0 && /^\d+$/.test(termoRaw)) {
      const r1 = (await ora.query(
        `SELECT COUNT(*) AS C FROM DBPROD WHERE CODPROD = :COD`,
        { replacements: { COD: termoRaw }, type: QueryTypes.SELECT },
      )) as any[];
      const r2 = (await ora.query(
        `SELECT COUNT(*) AS C
           FROM DBFORMACAOPRVENDA
          WHERE CODPROD = :COD
            AND TIPOPRECO = :TIPO
            AND PRECOVENDA > 0`,
        {
          replacements: { COD: termoRaw, TIPO: tipoCliente },
          type: QueryTypes.SELECT,
        },
      )) as any[];
      log('[DIAG ORACLE]', {
        cod: termoRaw,
        tipopreco: tipoCliente,
        has_prod: Number(r1?.[0]?.C || 0) > 0,
        has_price: Number(r2?.[0]?.C || 0) > 0,
      });
    }

    const formatted = rows.map(upperKeys);
    return res.status(200).json(formatted);
  } catch (e: any) {
    err('falha Oracle', e);
    return res
      .status(500)
      .json({ ok: false, error: e?.message || 'Erro Oracle' });
  }
}
