// pages/api/vendas/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient';
import { serializeBigInt } from '@/utils/serializeBigInt';

type FrontStatus =
  | 'salva'
  | 'salva2'
  | 'faturada'
  | 'finalizada'
  | 'cancelada'
  | 'bloqueada'
  | 'combinadas'
  | 'todas';

const mapStatusToDb = (s: FrontStatus) =>
  s === 'faturada'
    ? 'F'
    : s === 'finalizada'
    ? 'N'
    : s === 'cancelada'
    ? 'C'
    : s === 'bloqueada'
    ? 'B'
    : null;

function toInt(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def;
}

function mkMeta(total: number, page: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return { total, totalPages, currentPage, perPage };
}

/* WHERE dbvenda (faturada/finalizada/cancelada/bloqueada) */
const buildWhereClauseVenda = (filters: {
  codvenda?: string;
  codusr?: string;
  status?: string | null;
}) => {
  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (filters.codvenda) {
    clauses.push(`"codvenda" = $${i++}`);
    params.push(filters.codvenda);
  }
  if (filters.codusr) {
    clauses.push(`ltrim(("codusr")::text, '0') = ltrim(($${i})::text, '0')`);
    params.push(filters.codusr);
    i++;
  }
  if (filters.status) {
    clauses.push(`"status" = $${i++}`);
    params.push(filters.status);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

/* WHERE dbvenda (status IN (...)) — para junções */
const buildWhereClauseVendaMulti = (filters: {
  codvenda?: string;
  codusr?: string;
  statusIn?: string[]; // ex.: ['F','N','B']
}) => {
  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (filters.codvenda) {
    clauses.push(`"codvenda" = $${i++}`);
    params.push(filters.codvenda);
  }
  if (filters.codusr) {
    clauses.push(`ltrim(("codusr")::text, '0') = ltrim(($${i})::text, '0')`);
    params.push(filters.codusr);
    i++;
  }
  if (filters.statusIn && filters.statusIn.length > 0) {
    clauses.push(`"status" = ANY($${i++})`);
    params.push(filters.statusIn);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

/* WHERE dbvenda_draft (salvas) */
const buildWhereClauseDraft = (filters: {
  codvenda?: string;
  codusr?: string;
  tipo?: string; // para 'salva2' -> 'E'
  excludeTipoE?: boolean; // para 'salva' -> true (pegar todos exceto 'E')
}) => {
  const clauses: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (filters.codvenda) {
    clauses.push(`"codvenda" = $${i++}`);
    params.push(filters.codvenda);
  }
  if (filters.codusr) {
    clauses.push(`ltrim(("codusr")::text, '0') = ltrim(($${i})::text, '0')`);
    params.push(filters.codusr);
    i++;
  }
  if (filters.tipo) {
    clauses.push(`"tipo" = $${i++}`);
    params.push(filters.tipo);
  } else if (filters.excludeTipoE) {
    clauses.push(`("tipo" IS DISTINCT FROM 'E')`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

/* ================== ORDENACAO ================== */
function normalizeSort(
  sortBy?: string | string[] | undefined,
  sortDir?: string | string[] | undefined,
): {
  key: 'codvenda' | 'data' | 'total' | 'status' | 'codcli';
  dir: 'ASC' | 'DESC';
} {
  const rawKey = Array.isArray(sortBy) ? sortBy[0] : sortBy;
  const rawDir = (Array.isArray(sortDir) ? sortDir[0] : sortDir) || 'desc';

  const ALLOWED = new Set(['codvenda', 'data', 'total', 'status', 'codcli']);
  const key = ALLOWED.has(String(rawKey)) ? (rawKey as any) : 'data';
  const dir = String(rawDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return { key, dir };
}

function buildOrderVenda(
  key: ReturnType<typeof normalizeSort>['key'],
  dir: 'ASC' | 'DESC',
) {
  const map: Record<string, string> = {
    codvenda: `v."codvenda"`,
    data: `v."data"`,
    total: `v."total"`,
    status: `v."status"`,
    codcli: `v."codcli"`,
  };
  const col = map[key] ?? `v."data"`;
  return `ORDER BY ${col} ${dir}, v."codvenda" DESC`;
}

function buildOrderDraft(
  key: ReturnType<typeof normalizeSort>['key'],
  dir: 'ASC' | 'DESC',
) {
  const map: Record<string, string> = {
    codvenda: `"codvenda"`, // alias CAST(draft_id AS text)
    data: `d."updated_at"`,
    total: `"total"`,
    codcli: `d."codcli"`,
  };
  const col = map[key] ?? `d."updated_at"`;
  return `ORDER BY ${col} ${dir}, "codvenda" DESC`;
}

/* ================== BUSCA ================== */

// contém por padrão; respeita %/_ se o usuário já passou
function makeLike(termRaw: string) {
  const t = (termRaw ?? '').trim();
  if (t.includes('%') || t.includes('_')) return t;
  return `%${t}%`;
}

// PT-BR estrito -> US para comparação numérica (vírgula decimal, ponto milhar)
function normalizeMoneyPtBrStrict(termRaw: string): string | null {
  if (!termRaw) return null;
  const t = termRaw.trim();
  // 1.234.567,89 | 1234,89 | 1.234.567 | 1234567
  const ptbrPattern = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;
  if (!ptbrPattern.test(t)) return null;
  const noThousands = t.replace(/\./g, '');
  return noThousands.replace(',', '.'); // ex.: 1.305,01 -> 1305.01
}

/** VENDAS (dbvenda v.) — cliente por codcli OU nome OU nomefant via EXISTS em dbclien + TOTAL PT-BR + DATA BR */
function appendSearchToWhereVenda(
  base: { where: string; params: any[] },
  searchField: string | undefined,
  termRaw: string | undefined,
): { where: string; params: any[] } {
  const term = (termRaw ?? '').trim();
  if (!term) return base;

  const like = makeLike(term);
  const normMoney = normalizeMoneyPtBrStrict(term);
  const field = String(searchField ?? 'todos').toLowerCase();

  const cols: Record<string, string> = {
    codvenda: `v."codvenda"::text`,
    codcli: `v."codcli"::text`,
    data: `v."data"::text`,
    total: `v."total"::text`,
    status: `v."status"::text`,
  };

  // TOTAL em PT-BR (vírgula decimal, ponto milhar) + textual
  const pushTotalCondsPtBr = (
    conds: string[],
    params: any[],
    idxRef: { i: number },
  ) => {
    // (1) textual direto
    conds.push(`v."total"::text ILIKE $${idxRef.i++}`);
    params.push(like);

    // (2) BR sem milhar: 1305,01 (gera US fixo e troca . -> ,)
    conds.push(
      `replace(to_char(v."total"::numeric, 'FM999999999999.99'), '.', ',') ILIKE $${idxRef.i++}`,
    );
    params.push(like);

    // (3) BR com milhar: 1.305,01 (gera US fixo com vírgulas e faz troca segura)
    conds.push(
      `replace(replace(replace(to_char(v."total"::numeric, 'FM999,999,999,999.99'), ',', 'X'), '.', ','), 'X', '.') ILIKE $${idxRef.i++}`,
    );
    params.push(like);

    // (4) igualdade numérica se termo PT-BR válido
    if (normMoney) {
      conds.push(`v."total" = $${idxRef.i++}::numeric`);
      params.push(normMoney);
    }
  };

  const start = base.params.length + 1;

  // ===== campo específico =====
  if (field !== 'todos' && field !== 'todas') {
    // TOTAL
    if (field === 'total') {
      const conds: string[] = [];
      const params = [...base.params];
      const idx = { i: params.length + 1 };
      pushTotalCondsPtBr(conds, params, idx);

      const where = base.where
        ? `${base.where} AND (${conds.join(' OR ')})`
        : `WHERE (${conds.join(' OR ')})`;
      return { where, params };
    }

    // CLIENTE (codcli OU nome/nomefant)
    if (field === 'codcli' || field === 'cliente') {
      const cond = `(${cols.codcli} ILIKE $${start} OR EXISTS (
        SELECT 1 FROM "dbclien" c
        WHERE c."codcli"::text = v."codcli"::text
          AND (c."nome" ILIKE $${start + 1} OR c."nomefant" ILIKE $${start + 1})
      ))`;
      return {
        where: base.where ? `${base.where} AND ${cond}` : `WHERE ${cond}`,
        params: [...base.params, like, like],
      };
    }

    // DATA (DD/MM/YYYY e sem zero à esquerda)
    if (field === 'data') {
      const s = base.params.length + 1;
      const cond = [
        `v."data"::text ILIKE $${s}`, // yyyy-mm-dd
        `to_char(v."data", 'DD/MM/YYYY') ILIKE $${s + 1}`, // 03/10/2025
        `to_char(v."data", 'FMDD/MM/YYYY') ILIKE $${s + 2}`, // 3/10/2025
      ].join(' OR ');
      return {
        where: base.where ? `${base.where} AND (${cond})` : `WHERE (${cond})`,
        params: [...base.params, like, like, like],
      };
    }

    // demais campos mantêm ILIKE padrão
    const col = cols[field];
    if (!col) return base;
    const cond = `${col} ILIKE $${start}`;
    return {
      where: base.where ? `${base.where} AND (${cond})` : `WHERE ${cond}`,
      params: [...base.params, like],
    };
  }

  // ===== 'todos' / 'todas' =====
  {
    const conds: string[] = [];
    const params = [...base.params];
    const idx = { i: params.length + 1 };

    // (A) ILIKE em todas as colunas como antes (inclui textual de total)
    for (const c of Object.values(cols)) {
      conds.push(`${c} ILIKE $${idx.i++}`);
      params.push(like);
    }

    // (B) bloco TOTAL PT-BR extra
    pushTotalCondsPtBr(conds, params, idx);

    // (C) datas no formato BR (DD/MM/YYYY) e sem zero à esquerda
    conds.push(`to_char(v."data", 'DD/MM/YYYY') ILIKE $${idx.i++}`);
    params.push(like);
    conds.push(`to_char(v."data", 'FMDD/MM/YYYY') ILIKE $${idx.i++}`);
    params.push(like);

    // (D) EXISTS de cliente (nome/nomefant)
    conds.push(`EXISTS (
      SELECT 1 FROM "dbclien" c
      WHERE c."codcli"::text = v."codcli"::text
        AND (c."nome" ILIKE $${idx.i} OR c."nomefant" ILIKE $${idx.i})
    )`);
    params.push(like);
    idx.i++;

    const all = `(${conds.join(' OR ')})`;
    const where = base.where ? `${base.where} AND ${all}` : `WHERE ${all}`;
    return { where, params };
  }
}

/** DRAFTS (dbvenda_draft d.) — cliente via dbclien + TOTAL PT-BR + DATA BR (updated_at) */
function appendSearchToWhereDraft(
  base: { where: string; params: any[] },
  searchField: string | undefined,
  termRaw: string | undefined,
): { where: string; params: any[] } {
  const term = (termRaw ?? '').trim();
  if (!term) return base;

  const like = makeLike(term);
  const normMoney = normalizeMoneyPtBrStrict(term);
  const field = String(searchField ?? 'todos').toLowerCase();

  const cols: Record<string, string> = {
    codvenda: `CAST(d."draft_id" AS text)`,
    codcli: `d."codcli"::text`,
    data: `d."updated_at"::text`,
    total: `COALESCE(NULLIF(d."total",0), 0)::text`,
  };

  const pushTotalCondsPtBr = (
    conds: string[],
    params: any[],
    idxRef: { i: number },
  ) => {
    conds.push(`COALESCE(NULLIF(d."total",0), 0)::text ILIKE $${idxRef.i++}`); // textual
    params.push(like);

    conds.push(
      `replace(to_char(COALESCE(d."total",0)::numeric, 'FM999999999999.99'), '.', ',') ILIKE $${idxRef.i++}`,
    );
    params.push(like);

    conds.push(
      `replace(replace(replace(to_char(COALESCE(d."total",0)::numeric, 'FM999,999,999,999.99'), ',', 'X'), '.', ','), 'X', '.') ILIKE $${idxRef.i++}`,
    );
    params.push(like);

    if (normMoney) {
      conds.push(`COALESCE(d."total",0) = $${idxRef.i++}::numeric`);
      params.push(normMoney);
    }
  };

  const start = base.params.length + 1;

  if (field !== 'todos' && field !== 'todas') {
    if (field === 'total') {
      const conds: string[] = [];
      const params = [...base.params];
      const idx = { i: params.length + 1 };
      pushTotalCondsPtBr(conds, params, idx);
      const where = base.where
        ? `${base.where} AND (${conds.join(' OR ')})`
        : `WHERE (${conds.join(' OR ')})`;
      return { where, params };
    }

    if (field === 'codcli' || field === 'cliente') {
      const cond = `(${cols.codcli} ILIKE $${start} OR EXISTS (
        SELECT 1 FROM "dbclien" c
        WHERE c."codcli"::text = d."codcli"::text
          AND (c."nome" ILIKE $${start + 1} OR c."nomefant" ILIKE $${start + 1})
      ))`;
      return {
        where: base.where ? `${base.where} AND ${cond}` : `WHERE ${cond}`,
        params: [...base.params, like, like],
      };
    }

    if (field === 'status') return base; // draft não tem status

    // DATA (DD/MM/YYYY e sem zero à esquerda) em d.updated_at
    if (field === 'data') {
      const s = base.params.length + 1;
      const cond = [
        `d."updated_at"::text ILIKE $${s}`, // ISO timestamp
        `to_char(d."updated_at", 'DD/MM/YYYY') ILIKE $${s + 1}`,
        `to_char(d."updated_at", 'FMDD/MM/YYYY') ILIKE $${s + 2}`,
      ].join(' OR ');
      return {
        where: base.where ? `${base.where} AND (${cond})` : `WHERE (${cond})`,
        params: [...base.params, like, like, like],
      };
    }

    const col = cols[field];
    if (!col) return base;
    const cond = `${col} ILIKE $${start}`;
    return {
      where: base.where ? `${base.where} AND (${cond})` : `WHERE ${cond}`,
      params: [...base.params, like],
    };
  }

  // 'todos' / 'todas'
  {
    const conds: string[] = [];
    const params = [...base.params];
    const idx = { i: params.length + 1 };

    for (const c of Object.values(cols)) {
      conds.push(`${c} ILIKE $${idx.i++}`);
      params.push(like);
    }

    // TOTAL PT-BR
    pushTotalCondsPtBr(conds, params, idx);

    // datas BR
    conds.push(`to_char(d."updated_at", 'DD/MM/YYYY') ILIKE $${idx.i++}`);
    params.push(like);
    conds.push(`to_char(d."updated_at", 'FMDD/MM/YYYY') ILIKE $${idx.i++}`);
    params.push(like);

    // cliente por nome/nomefant
    conds.push(`EXISTS (
      SELECT 1 FROM "dbclien" c
      WHERE c."codcli"::text = d."codcli"::text
        AND (c."nome" ILIKE $${idx.i} OR c."nomefant" ILIKE $${idx.i})
    )`);
    params.push(like);
    idx.i++;

    const all = `(${conds.join(' OR ')})`;
    const where = base.where ? `${base.where} AND ${all}` : `WHERE ${all}`;
    return { where, params };
  }
}

/* ================== QUERIES ================== */
async function queryOnlyDrafts(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
  page: number,
  perPage: number,
  orderSql?: string,
) {
  const countSql = `
    SELECT COUNT(*)::bigint AS total
    FROM "dbvenda_draft" d
    ${whereObj.where};
  `;
  const countRes = await client.query(countSql, whereObj.params);
  const total = Number(countRes.rows?.[0]?.total ?? 0);

  const listSql = `
    SELECT
      CAST(d."draft_id" AS text) AS "codvenda",
      CAST(d."codcli"   AS text) AS "codcli",
      d."updated_at"              AS "data",
      (
        SELECT COALESCE(SUM(
          GREATEST(
            COALESCE(NULLIF(i->>'totalItem','')::numeric, 0),
            COALESCE(NULLIF(i->>'totitem','')::numeric, 0),
            COALESCE(NULLIF(i->>'vlrtotal','')::numeric, 0),
            COALESCE(NULLIF(i->>'total_item','')::numeric, 0),
            COALESCE(
              NULLIF(i->>'vltotalItem','')::numeric,
              COALESCE(NULLIF(i->>'quantidade','')::numeric, 0) *
              COALESCE(
                NULLIF(i->>'precoItemEditado','')::numeric,
                NULLIF(i->>'preço','')::numeric,
                NULLIF(i->>'preco','')::numeric,
                0
              ) * (1 - COALESCE(NULLIF(i->>'desconto','')::numeric,0)/100.0)
            )
          )
        ),0)
        FROM jsonb_array_elements(COALESCE(d."payload"->'itens','[]'::jsonb)) i
      )                           AS "total",
      CASE WHEN d."tipo" = 'E' THEN 'SALVA2' ELSE 'SALVA' END AS "tipoOrigem",
      d."label"
    FROM "dbvenda_draft" d
    ${whereObj.where}
    ${orderSql ?? `ORDER BY d."updated_at" DESC, "codvenda" DESC`}
    LIMIT $${whereObj.params.length + 1}
    OFFSET $${whereObj.params.length + 2};
  `;
  const listParams = [...whereObj.params, perPage, (page - 1) * perPage];
  const listRes = await client.query(listSql, listParams);

  return { total, rows: listRes.rows };
}

/* Sem paginação (para junções) */
async function queryDraftsRaw(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
) {
  const sql = `
    SELECT
      CAST(d."draft_id" AS text) AS "codvenda",
      CAST(d."codcli"   AS text) AS "codcli",
      d."updated_at"              AS "data",
      (
        SELECT COALESCE(SUM(
          GREATEST(
            COALESCE(NULLIF(i->>'totalItem','')::numeric, 0),
            COALESCE(NULLIF(i->>'totitem','')::numeric, 0),
            COALESCE(NULLIF(i->>'vlrtotal','')::numeric, 0),
            COALESCE(NULLIF(i->>'total_item','')::numeric, 0),
            COALESCE(
              NULLIF(i->>'vltotalItem','')::numeric,
              COALESCE(NULLIF(i->>'quantidade','')::numeric, 0) *
              COALESCE(
                NULLIF(i->>'precoItemEditado','')::numeric,
                NULLIF(i->>'preço','')::numeric,
                NULLIF(i->>'preco','')::numeric,
                0
              ) * (1 - COALESCE(NULLIF(i->>'desconto','')::numeric,0)/100.0)
            )
          )
        ),0)
        FROM jsonb_array_elements(COALESCE(d."payload"->'itens','[]'::jsonb)) i
      )                           AS "total",
      CASE WHEN d."tipo" = 'E' THEN 'SALVA2' ELSE 'SALVA' END AS "tipoOrigem",
      d."label"
    FROM "dbvenda_draft" d
    ${whereObj.where}
  `;
  const resRaw = await client.query(sql, whereObj.params);
  return resRaw.rows;
}

async function queryOnlyVendas(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
  page: number,
  perPage: number,
  orderSql?: string,
) {
  const countSql = `
    SELECT COUNT(*)::bigint AS total
    FROM "dbvenda" v
    ${whereObj.where};
  `;
  const countRes = await client.query(countSql, whereObj.params);
  const total = Number(countRes.rows?.[0]?.total ?? 0);

  const listSql = `
    SELECT
      CAST(v."codvenda" AS text) AS "codvenda",
      CAST(v."codcli"   AS text) AS "codcli",
      v."data"                   AS "data",
      v."total"                  AS "total",
      v."status"                 AS "status",
      'VENDA'                    AS "tipoOrigem",
      NULL::text                 AS "label"
    FROM "dbvenda" v
    ${whereObj.where}
    ${orderSql ?? `ORDER BY v."data" DESC, v."codvenda" DESC`}
    LIMIT $${whereObj.params.length + 1}
    OFFSET $${whereObj.params.length + 2};
  `;
  const listParams = [...whereObj.params, perPage, (page - 1) * perPage];
  const listRes = await client.query(listSql, listParams);

  return { total, rows: listRes.rows };
}

/* Sem paginação (para junções) */
async function queryVendasRaw(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
) {
  const sql = `
    SELECT
      CAST(v."codvenda" AS text) AS "codvenda",
      CAST(v."codcli"   AS text) AS "codcli",
      v."data"                   AS "data",
      v."total"                  AS "total",
      v."status"                 AS "status",
      'VENDA'                    AS "tipoOrigem",
      NULL::text                 AS "label"
    FROM "dbvenda" v
    ${whereObj.where}
  `;
  const resRaw = await client.query(sql, whereObj.params);
  return resRaw.rows;
}

function mergeUniqueByCodvenda(...lists: any[][]) {
  const map = new Map<string, any>();
  for (const list of lists) {
    for (const v of list) {
      const key = String(v.codvenda);
      if (!map.has(key)) map.set(key, v);
    }
  }
  return Array.from(map.values());
}

function paginarArray<T>(arr: T[], page: number, perPage: number) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const data = arr.slice(start, end);
  return {
    data,
    meta: mkMeta(arr.length, page, perPage),
  };
}

/* ---------------------------------------------------- */
async function hydrateRows(client: PoolClient, rows: any[]) {
  if (!rows || rows.length === 0) return rows;

  // ids usados para enriquecer
  const vendaIds: string[] = rows.map((v: any) => String(v.codvenda));
  const clientIds: string[] = rows
    .map((v: any) => v.codcli)
    .filter((c: any): c is string => !!c)
    .map((c: any) => String(c));

  // 1) itens finalizados (somente para VENDA)
  const itensFinalizadosQuery = `
    SELECT di.*, JSON_BUILD_OBJECT(
      'codprod', dp.codprod,
      'descr', dp.descr,
      'origem', dp.tipo,
      'qtest', dp.qtest,
      'prvenda', dp.prvenda,
      'dbmarcas', JSON_BUILD_OBJECT(
        'codmarca', dm.codmarca,
        'descr', dm.descr
      )
    ) AS dbprod
    FROM dbitvenda di
    LEFT JOIN dbprod dp ON dp.codprod = di.codprod
    LEFT JOIN dbmarcas dm ON dm.codmarca = dp.codmarca
    WHERE di.codvenda = ANY($1::text[])
  `;

  // 2) clientes (NOMES!) — voltando com nome/nomefant
  const clientesQuery = `
    SELECT codcli::text AS codcli, nome, nomefant
    FROM dbclien
    WHERE codcli = ANY($1::text[])
  `;

  const [itensFinalizadosRes, clientesRes] = await Promise.all([
    client.query(itensFinalizadosQuery, [vendaIds]),
    client.query(clientesQuery, [clientIds]),
  ]);

  // Map de itens de venda finalizada
  const itensMap = new Map<string, any[]>();
  for (const r of itensFinalizadosRes.rows) {
    const key = String(r.codvenda);
    const arr = itensMap.get(key) ?? [];
    arr.push(r);
    itensMap.set(key, arr);
  }

  // Map de clientes (com nome/nomefant)
  const clientesMap = new Map<
    string,
    { codcli: string; nome?: string; nomefant?: string }
  >();
  for (const c of clientesRes.rows) {
    clientesMap.set(String(c.codcli), {
      codcli: String(c.codcli),
      nome: c.nome ?? null,
      nomefant: c.nomefant ?? null,
    });
  }

  // Enriquecimento por linha
  for (const v of rows) {
    const id = String(v.codvenda);

    // anexa o cliente (para o front usar nomefant || nome)
    v.dbclien = v.codcli ? clientesMap.get(String(v.codcli)) ?? null : null;

    if (v.tipoOrigem === 'VENDA') {
      v.dbitvenda = (itensMap.get(id) ?? []).map((i: any) => ({
        ...i,
        total_item: String(i.totitem),
        vlrtotal: String(i.totitem),
      }));
    } else {
      // origem SALVA/SALVA2 (draft)
      const itens: any[] = Array.isArray(v?.payload?.itens)
        ? v.payload.itens
        : Array.isArray(v?.itens)
        ? v.itens
        : [];

      const itensEnriquecidos = itens.map((i: any) => {
        const unit =
          Number(
            i.precoItemEditado ?? i['preço'] ?? i.preco ?? i.prvenda ?? 0,
          ) || 0;
        const qty = Number(i.quantidade ?? i.quantidadeNum ?? i.qtd ?? 0) || 0;
        const disc = Number(i.desconto ?? 0) || 0;

        const vlUnit = unit * (1 - disc / 100);
        const total = vlUnit * qty;

        const unitStr = String(unit);
        const vlUnitStr = String(vlUnit);
        const totStr = String(total);

        return {
          ...i,
          prunit: unitStr,
          prvenda: unitStr,
          vlunit: vlUnitStr,
          vlrunit: vlUnitStr,
          totitem: totStr,
          total_item: totStr,
          vlrtotal: totStr,
          dbprod: {
            codprod: String(i.codprod ?? i.codigo ?? ''),
            descr: String(i.descriçãoEditada ?? i.descrição ?? ''),
            tipo: String(i.origem ?? ''),
            qtest: Number(i.estoque ?? 0),
            prvenda: unit,
            dbmarcas: { codmarca: null, descr: String(i.marca ?? '') },
          },
        };
      });

      v.itens = itensEnriquecidos;
      v.dbitvenda = itensEnriquecidos.map((i: any) => ({
        codvenda: id,
        codprod: String(i.codprod ?? i.codigo ?? ''),
        qtd: String(i.qtd ?? i.quantidade ?? i.quantidadeNum ?? 0),
        prunit: String(i.prunit),
        prvenda: String(i.prvenda),
        vlunit: String(i.vlunit),
        vlrunit: String(i.vlrunit),
        totitem: String(i.totitem),
        vlrtotal: String(i.vlrtotal ?? i.totitem),
        total_item: String(i.total_item ?? i.totitem),
        preco_unit: String(i.preco_unit),
        desconto: String(i.desconto ?? 0),
        dbprod: i.dbprod,
      }));
    }
  }

  return rows;
}

/* ----------------------------- HANDLER ----------------------------- */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;

  try {
    const cookies = parseCookies({ req });
    const filial = cookies.filial_melo;
    if (!filial) {
      return res.status(400).json({
        data: [],
        meta: mkMeta(0, 1, 10),
        message: 'Filial não informada no cookie',
      });
    }

    const pool = getPgPool(filial);
    client = await pool.connect();

    const page = toInt(req.query.page, 1);
    const perPage = toInt(req.query.perPage, 10);

    const statusFront =
      ((Array.isArray(req.query.status)
        ? req.query.status[0]
        : req.query.status) as FrontStatus) || 'salva';

    const codusr =
      (Array.isArray(req.query.codvend_usuario)
        ? req.query.codvend_usuario[0]
        : req.query.codvend_usuario) ||
      (Array.isArray(req.query.codusr)
        ? req.query.codusr[0]
        : req.query.codusr) ||
      undefined;

    const codvendaFilter = (
      Array.isArray(req.query.codvenda)
        ? req.query.codvenda[0]
        : req.query.codvenda
    ) as string | undefined;

    // parâmetros de busca (front envia search + searchField)
    const search =
      (Array.isArray((req.query as any).search)
        ? (req.query as any).search[0]
        : (req.query as any).search) || undefined;
    const searchField =
      (Array.isArray((req.query as any).searchField)
        ? (req.query as any).searchField[0]
        : (req.query as any).searchField) || 'todos';

    const { key: sortKey, dir: sortDir } = normalizeSort(
      req.query.sortBy,
      req.query.sortDir,
    );
    const orderVendaSql = buildOrderVenda(sortKey, sortDir);
    const orderDraftSql = buildOrderDraft(sortKey, sortDir);

    if (!codusr) {
      return res.status(200).json({ data: [], meta: mkMeta(0, page, perPage) });
    }

    /* --- SALVA (drafts sem tipo E) --- */
    if (statusFront === 'salva') {
      const draftWhereBase = buildWhereClauseDraft({
        codvenda: codvendaFilter,
        codusr,
        excludeTipoE: true,
      });
      const draftWhere = appendSearchToWhereDraft(
        draftWhereBase,
        searchField,
        search,
      );

      const { total, rows } = await queryOnlyDrafts(
        client,
        draftWhere,
        page,
        perPage,
        orderDraftSql,
      );
      const hydrated = await hydrateRows(client, rows);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta: mkMeta(total, page, perPage),
      });
    }

    /* --- TODAS (drafts sem E + drafts E + vendas F/N/B) --- */
    if (statusFront === 'todas') {
      const draftsSemE = await queryDraftsRaw(
        client,
        appendSearchToWhereDraft(
          buildWhereClauseDraft({
            codvenda: codvendaFilter,
            codusr,
            excludeTipoE: true,
          }),
          searchField,
          search,
        ),
      );

      const draftsE = await queryDraftsRaw(
        client,
        appendSearchToWhereDraft(
          buildWhereClauseDraft({
            codvenda: codvendaFilter,
            codusr,
            tipo: 'E',
          }),
          searchField,
          search,
        ),
      );

      const vendasFNB = await queryVendasRaw(
        client,
        appendSearchToWhereVenda(
          buildWhereClauseVendaMulti({
            codvenda: codvendaFilter,
            codusr,
            statusIn: ['F', 'N', 'B'],
          }),
          searchField,
          search,
        ),
      );

      const unificados = mergeUniqueByCodvenda(draftsSemE, draftsE, vendasFNB);
      unificados.sort((a, b) => {
        const mult = sortDir === 'ASC' ? 1 : -1;
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        // data
        if (sortKey === 'data') {
          const da = av ? new Date(av).getTime() : 0;
          const db = bv ? new Date(bv).getTime() : 0;
          if (da !== db) return (da - db) * mult;
          return -String(a.codvenda).localeCompare(String(b.codvenda));
        }
        // numérico
        const na = Number(av);
        const nb = Number(bv);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
          return (na - nb) * mult;
        }
        // string
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
        if (cmp !== 0) return cmp * mult;
        return -String(a.codvenda).localeCompare(String(b.codvenda));
      });

      const { data, meta } = paginarArray(unificados, page, perPage);
      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    /* --- SALVA2 (drafts tipo E) --- */
    if (statusFront === 'salva2') {
      const draftWhereBase = buildWhereClauseDraft({
        codvenda: codvendaFilter,
        codusr,
        tipo: 'E',
      });
      const draftWhere = appendSearchToWhereDraft(
        draftWhereBase,
        searchField,
        search,
      );

      const rows = await queryDraftsRaw(client, draftWhere);
      rows.sort((a, b) => {
        const mult = sortDir === 'ASC' ? 1 : -1;
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        const na = Number(av);
        const nb = Number(bv);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
          return (na - nb) * mult;
        }
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
        if (cmp !== 0) return cmp * mult;
        return -String(a.codvenda).localeCompare(String(b.codvenda));
      });

      const { data, meta } = paginarArray(rows, page, perPage);
      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    /* --- BLOQUEADA --- */
    if (statusFront === 'bloqueada') {
      const vendaWhereBase = buildWhereClauseVenda({
        codvenda: codvendaFilter,
        codusr,
        status: 'B',
      });
      const vendaWhere = appendSearchToWhereVenda(
        vendaWhereBase,
        searchField,
        search,
      );

      const { total, rows } = await queryOnlyVendas(
        client,
        vendaWhere,
        page,
        perPage,
        orderVendaSql,
      );
      const hydrated = await hydrateRows(client, rows);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta: mkMeta(total, page, perPage),
      });
    }

    /* --- COMBINADAS (drafts sem E + vendas F/N) --- */
    if (statusFront === 'combinadas') {
      const draftsSemE = await queryDraftsRaw(
        client,
        appendSearchToWhereDraft(
          buildWhereClauseDraft({
            codvenda: codvendaFilter,
            codusr,
            excludeTipoE: true,
          }),
          searchField,
          search,
        ),
      );

      const vendasFN = await queryVendasRaw(
        client,
        appendSearchToWhereVenda(
          buildWhereClauseVendaMulti({
            codvenda: codvendaFilter,
            codusr,
            statusIn: ['F', 'N'],
          }),
          searchField,
          search,
        ),
      );

      const unificados = mergeUniqueByCodvenda(draftsSemE, vendasFN);
      unificados.sort((a, b) => {
        const mult = sortDir === 'ASC' ? 1 : -1;
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        const na = Number(av);
        const nb = Number(bv);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
          return (na - nb) * mult;
        }
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
        if (cmp !== 0) return cmp * mult;
        return -String(a.codvenda).localeCompare(String(b.codvenda));
      });

      const { data, meta } = paginarArray(unificados, page, perPage);
      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    /* --- FATURADA / FINALIZADA / CANCELADA --- */
    const dbStatus = mapStatusToDb(statusFront);
    const vendaWhereBase = buildWhereClauseVenda({
      codvenda: codvendaFilter,
      codusr,
      status: dbStatus,
    });
    const vendaWhere = appendSearchToWhereVenda(
      vendaWhereBase,
      searchField,
      search,
    );

    const { total, rows } = await queryOnlyVendas(
      client,
      vendaWhere,
      page,
      perPage,
      orderVendaSql,
    );
    const hydrated = await hydrateRows(client, rows);
    return res.status(200).json({
      data: serializeBigInt(hydrated),
      meta: mkMeta(total, page, perPage),
    });
  } catch (error: any) {
    console.error('Erro ao buscar vendas:', error?.message || error);
    res.status(500).json({
      message: 'Erro interno ao buscar as vendas.',
      error: error?.message || String(error),
    });
  } finally {
    if (client) client.release();
  }
}
