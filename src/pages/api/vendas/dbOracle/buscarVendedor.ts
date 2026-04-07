// pages/api/vendas/oracle/buscarVendedores.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { parseCookies } from 'nookies';
import { Sequelize, QueryTypes } from 'sequelize';
const oracledb = require('oracledb');

/* ---------------- Logger (opcional) ---------------- */
function mkLogger(tag: string) {
  const id = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${id}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${id}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
    }
  };
  return { log, err };
}

/* ---------------- Oracle via Sequelize ---------------- */
let _oraSequelize: Sequelize | null = null;
async function getOracleSequelize() {
  if (!_oraSequelize) {
    // Ajuste o libDir conforme seu ambiente
    await oracledb.initOracleClient({
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4',
    });

    const url = process.env.DATABASE_URL2;
    if (!url)
      throw new Error('DATABASE_URL2 ausente para Oracle via Sequelize.');

    _oraSequelize = new Sequelize(url, { logging: false });
  }
  return _oraSequelize!;
}

/* ---------------- Helper: upper keys ---------------- */
function upperKeys(row: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of Object.keys(row)) out[k.toUpperCase()] = row[k];
  return out;
}

/* ---------------- Handler ---------------- */
export default async function Sec(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const { err } = mkLogger('DBVEND-Oracle');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const filial = cookies.filial_melo;

  if (!filial) {
    console.error('ERROR: BRANCH NOT PROVIDED IN COOKIE.');
    return res.status(400).json({ error: 'BRANCH NOT PROVIDED IN COOKIE' });
  }

  let ora: Sequelize | null = null;

  try {
    ora = await getOracleSequelize();

    const querySql = `
      SELECT
        c.CODVEND   AS codvend,
        c.NOME      AS nome,
        c.VALOBJ    AS valobj,
        c.COMNORMAL AS comnormal,
        c.COMTELE   AS comtele,
        c.DEBITO    AS debito,
        c.CREDITO   AS credito,
        c.LIMITE    AS limite,
        c.STATUS    AS status,
        c.CODCV     AS codcv,
        c.COMOBJ    AS comobj,
        c.VALOBJF   AS valobjf,
        c.VALOBJM   AS valobjm,
        c.VALOBJSF  AS valobjsf,
        c.RA_MAT    AS ra_mat
      FROM DBVEND c
    `;

    const rows = (await ora.query(querySql, {
      type: QueryTypes.SELECT,
    })) as Record<string, any>[];

    const data = rows.map(upperKeys);
    return res.status(200).json(data);
  } catch (e: any) {
    err('UNEXPECTED ERROR IN API ROUTE (Oracle)', e);
    return res
      .status(500)
      .json({ error: 'ERROR FETCHING SALESPERSON DATA (Oracle)' });
  }
}
