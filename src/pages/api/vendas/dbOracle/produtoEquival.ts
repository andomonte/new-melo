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
export default async function Sec(req: NextApiRequest, res: NextApiResponse) {
  const { log, err } = mkLogger('Sec-Oracle');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;
  if (!filial) {
    console.error('ERRO: FILIAL NÃO INFORMADA NO COOKIE.');
    return res.status(400).json({ error: 'FILIAL NÃO INFORMADA NO COOKIE' });
  }
  log('filial_melo:', filial);

  const { CODGPE, PRVENDA } = (req.body || {}) as {
    CODGPE?: string;
    PRVENDA?: string | number;
  };

  let tipoCliente = '0';
  if (PRVENDA != null && PRVENDA !== '') tipoCliente = String(PRVENDA);

  try {
    const ora = await getOracleSequelize();

    const sql = `
      SELECT
        p.REF,
        p.CODGPE,
        p.CODPROD,
        p.DESCR,
        p.QTEST,
        (NVL(p.QTEST, 0) - NVL(p.QTDRESERVADA, 0)) AS QTDDISPONIVEL,
        m.DESCR AS "MARCA",
        fp.PRECOVENDA
      FROM DBPROD p
      JOIN DBMARCAS m
        ON m.CODMARCA = p.CODMARCA
      JOIN DBFORMACAOPRVENDA fp
        ON fp.CODPROD = p.CODPROD
      WHERE
            fp.PRECOVENDA > 0
        AND fp.TIPOPRECO = :TIPO
        AND UPPER(p.CODGPE) LIKE UPPER(:GPE)
        -- ====== REGRAS NOVAS (not((INF='D') OR (EXCLUIDO=1))) ======
        AND NVL(p.INF, '') <> 'D'
        AND NVL(p.EXCLUIDO, 0) <> 1
        -- ===========================================================
      ORDER BY QTDDISPONIVEL DESC
    `;

    // Observação: você está usando LIKE sem % no parâmetro.
    // Se quiser prefixo/contém, ajuste para '%valor%' aqui.
    const params = {
      GPE: String(CODGPE ?? '').trim(),
      TIPO: tipoCliente,
    };

    const rows = (await ora.query(sql, {
      replacements: params,
      type: QueryTypes.SELECT,
    })) as any[];

    const formatted = rows.map(upperKeys);
    return res.status(200).json(formatted);
  } catch (e: any) {
    err('ERRO INESPERADO NO API ROUTE (Oracle)', e);
    return res.status(500).json({ error: 'ERRO AO BUSCAR DADOS DO PRODUTO' });
  }
}
