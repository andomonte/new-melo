// pages/api/vendas/reload-cad-armazem-produto.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { getPgPool } from '@/lib/pgClient';
import { Sequelize, QueryTypes } from 'sequelize';
import { parseCookies } from 'nookies';

// Oracle client
const oracledb = require('oracledb');

/* ========= logger + debug helpers ========= */
function mkLogger(tag: string) {
  const traceId = Math.random().toString(36).slice(2, 10);
  const log = (...args: any[]) => console.log(`[${tag}] [${traceId}]`, ...args);
  const err = (msg: string, e?: any) => {
    console.error(`[${tag}] [${traceId}] ERROR: ${msg}`);
    if (e) {
      console.error(e?.message || e);
      if (e?.stack) console.error(e.stack);
      if (e?.code) console.error('code:', e.code);
      if (e?.detail) console.error('detail:', e.detail);
      if (e?.hint) console.error('hint:', e.hint);
    }
  };
  return { traceId, log, err };
}
function dbgEnabled(req: NextApiRequest) {
  return String(req.query.debug || 'false').toLowerCase() === 'true';
}
function safeJson(x: any) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

/* ========= Oracle via Sequelize ========= */
let _ora: any | null = null;
async function getOracleSequelize() {
  if (!_ora) {
    await oracledb.initOracleClient({
      // ajuste o caminho do seu instant client, se necessário
      libDir: 'C:\\oracle\\instantclient\\instantclient_23_4',
    });
    if (!process.env.DATABASE_URL2) {
      throw new Error('DATABASE_URL2 ausente (string de conexão Oracle).');
    }
    _ora = new Sequelize(process.env.DATABASE_URL2, { logging: false });
  }
  return _ora;
}

/* ========= Tipos ========= */
type RowGrouped = {
  ARP_ARM_ID: number | string;
  ARP_CODPROD: string;
  SUM_QTEST: number | string | null;
  SUM_QTEST_RES: number | string | null;
  BLOQUEADO_FINAL: string | null;
};

/* ========= Helpers ========= */
function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Paginação com ROW_NUMBER (estável e compatível).
 * - startRow: 1-based
 * - endRow: inclusive
 * Agrega a PÁGINA inteira por (ARM_ID, CODPROD), consolidando duplicados.
 */
function buildOracleGroupedSqlRN(
  startRow: number,
  endRow: number,
  arm_id?: number,
  codprod?: string,
) {
  const filters: string[] = [];
  const rep: any = { startRow, endRow };

  if (typeof arm_id === 'number' && !Number.isNaN(arm_id)) {
    filters.push('ARP.ARP_ARM_ID = :arm_id');
    rep.arm_id = arm_id;
  }
  if (codprod) {
    filters.push('ARP.ARP_CODPROD = :codprod');
    rep.codprod = codprod;
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const sql = `
    WITH BASE AS (
      SELECT
        ARP.ARP_ARM_ID,
        ARP.ARP_CODPROD,
        ARP.ARP_QTEST,
        ARP.ARP_QTEST_RESERVADA,
        ARP.ARP_BLOQUEADO,
        ROW_NUMBER() OVER (
          ORDER BY ARP.ARP_ARM_ID, ARP.ARP_CODPROD, NVL(ARP.ARP_QTEST,0), NVL(ARP.ARP_QTEST_RESERVADA,0)
        ) AS RN
      FROM CAD_ARMAZEM_PRODUTO ARP
      ${where}
    ),
    PAGE AS (
      SELECT * FROM BASE
      WHERE RN BETWEEN :startRow AND :endRow
    )
    SELECT
      ARP_ARM_ID,
      ARP_CODPROD,
      SUM(COALESCE(ARP_QTEST, 0))           AS SUM_QTEST,
      SUM(COALESCE(ARP_QTEST_RESERVADA, 0)) AS SUM_QTEST_RES,
      CASE
        WHEN MAX(CASE WHEN ARP_BLOQUEADO = 'S' THEN 1 ELSE 0 END) = 1 THEN 'S'
        ELSE MAX(ARP_BLOQUEADO)
      END AS BLOQUEADO_FINAL
    FROM PAGE
    GROUP BY ARP_ARM_ID, ARP_CODPROD
  `;
  return { sql, rep };
}

async function insertPgBatch(client: PoolClient, rows: RowGrouped[]) {
  if (!rows.length) return { inserted: 0 };
  const cols = [
    'arp_arm_id',
    'arp_codprod',
    'arp_qtest',
    'arp_qtest_reservada',
    'arp_bloqueado',
  ];
  const values: any[] = [];
  const tuples: string[] = [];

  rows.forEach((r, i) => {
    const b = i * cols.length;
    tuples.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`);
    values.push(
      Number(r.ARP_ARM_ID),
      String(r.ARP_CODPROD),
      toNumOrNull(r.SUM_QTEST),
      toNumOrNull(r.SUM_QTEST_RES),
      r.BLOQUEADO_FINAL ? String(r.BLOQUEADO_FINAL) : null,
    );
  });

  const sql = `
    INSERT INTO cad_armazem_produto
      (arp_arm_id, arp_codprod, arp_qtest, arp_qtest_reservada, arp_bloqueado)
    VALUES ${tuples.join(',')}
  `;
  await client.query(sql, values);
  return { inserted: rows.length };
}

/* ========= Handler ========= */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { traceId, log, err } = mkLogger('reload-cad_armazem_produto');
  const DEBUG = dbgEnabled(req);

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies({ req });
    const filial = cookies.filial_melo; // seu padrão multi-filial
    const pgPool = getPgPool(filial);
    const pg = await pgPool.connect();
    const ora = await getOracleSequelize();

    const arm_id = req.query.arm_id ? Number(req.query.arm_id) : undefined;
    const codprod = req.query.codprod ? String(req.query.codprod) : undefined;

    // PageSize alto reduz chance de duplicados espalhados entre páginas
    const pageSize = Math.min(
      Math.max(Number(req.query.pageSize || 20000), 1000),
      50000,
    );

    if (DEBUG)
      console.log('[reload] params', { arm_id, codprod, pageSize, traceId });

    let offset = 0;
    let totalRead = 0;
    let totalInserted = 0;
    let batches = 0;

    for (;;) {
      const start = offset + 1; // 1-based
      const end = offset + pageSize; // inclusive

      const { sql, rep } = buildOracleGroupedSqlRN(start, end, arm_id, codprod);

      if (DEBUG) {
        console.log('[reload] ORACLE SQL:\n', sql);
        console.log('[reload] ORACLE BINDS:', safeJson(rep));
      }

      const page: RowGrouped[] = await ora.query(sql, {
        type: QueryTypes.SELECT,
        replacements: rep,
      });

      const count = page.length;
      if (DEBUG)
        console.log('[reload] ORACLE PAGE COUNT:', count, 'offset=', offset);

      if (count === 0) break;

      totalRead += count;
      batches += 1;

      const subs = chunk(page, 2500);

      if (DEBUG) console.log('[reload] PG BEGIN batch');
      await pg.query('BEGIN');
      try {
        for (const sub of subs) {
          const { inserted } = await insertPgBatch(pg, sub);
          totalInserted += inserted;
        }
        await pg.query('COMMIT');
        if (DEBUG)
          console.log(
            '[reload] PG COMMIT batch, inserted so far:',
            totalInserted,
          );
      } catch (e) {
        await pg.query('ROLLBACK');
        throw e;
      }

      offset += pageSize;

      // Se estiver filtrado, fecha cedo quando a página vier menor que o limite
      if ((arm_id !== undefined || codprod !== undefined) && count < pageSize)
        break;
    }

    pg.release();

    const resp = {
      ok: true as const,
      mode: 'reload' as const,
      totalRead,
      totalInserted,
      batches,
      pageSize,
      filters: { arm_id, codprod },
      traceId,
      note: 'Tabela deve estar vazia; índice único (arp_arm_id, arp_codprod) recomendado.',
    };

    log('done', resp);
    return res.status(200).json(resp);
  } catch (e: any) {
    err('falha geral', e);
    return res.status(500).json({
      ok: false,
      error: e?.message || 'Erro no reload',
      traceId,
      help: 'https://docs.oracle.com/error-help/db/ora-00907/',
    });
  }
}
