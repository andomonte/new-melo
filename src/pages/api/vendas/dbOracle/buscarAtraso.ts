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
 * Oracle via Sequelize (base)
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
export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { log, err } = mkLogger('MinDtReceb-Oracle');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERROR: BRANCH NOT PROVIDED IN COOKIE.');
    return res.status(400).json({ error: 'BRANCH NOT PROVIDED IN COOKIE' });
  }
  log('filial_melo:', filial);

  const { codClient } = (req.body || {}) as { codClient?: string };
  if (!codClient || String(codClient).trim() === '') {
    return res.status(400).json({ error: 'codClient é obrigatório.' });
  }

  try {
    const ora = await getOracleSequelize();

    // Equivalente ao seu SQL do Postgres:
    // - ILIKE -> comparação direta/upper (Oracle não tem ILIKE)
    // - MIN(DT_VENC) como DT_MIN
    // - REC = 'N' e CANCEL = 'N'
    // - CODCLI = :COD (se quiser LIKE, ver observação abaixo)
    const sql = `
      SELECT
        MIN(DT_VENC) AS DT_MIN
      FROM DBRECEB
      WHERE UPPER(REC) = 'N'
        AND UPPER(CANCEL) = 'N'
        AND CODCLI = :COD
    `;

    const rows = (await ora.query(sql, {
      replacements: { COD: String(codClient).trim() },
      type: QueryTypes.SELECT,
    })) as any[];

    // Mantém saída com chaves em CAIXA ALTA
    const formatted = rows.map(upperKeys);
    return res.status(200).json(formatted);
  } catch (e: any) {
    err('UNEXPECTED ERROR IN API ROUTE (Oracle)', e);
    return res.status(500).json({ error: 'ERROR FETCHING RECEIVABLES DATA' });
  }
}
