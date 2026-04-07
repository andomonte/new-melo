// pages/api/vendas/get.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PoolClient } from 'pg';
import { parseCookies } from 'nookies';
import { getPgPool } from '@/lib/pgClient'; // ✅ usa o client multi-bancos
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
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return { total, totalPages, currentPage: page, perPage };
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
    // filtro explícito por tipo (ex.: 'E')
    clauses.push(`"tipo" = $${i++}`);
    params.push(filters.tipo);
  } else if (filters.excludeTipoE) {
    // incluir NULL e tudo que não seja 'E'
    clauses.push(`("tipo" IS DISTINCT FROM 'E')`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

/* ================== ORDENACAO (whitelist) ================== */

/**
 * Normaliza sortBy/sortDir vindos da UI para uma chave segura.
 * Chaves permitidas (presentes em AMBAS as fontes — venda e draft):
 *  - codvenda (dbvenda.codvenda / dbvenda_draft.draft_id)
 *  - data
 *  - total
 *  - status
 *  - codcli
 */
function normalizeSort(
  sortBy?: string | string[],
  sortDir?: string | string[],
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

/**
 * Retorna SQL de ORDER BY para dbvenda (tabela finalizadas/faturadas/etc.)
 * Usa WHITELIST de colunas reais.
 */
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
  // sempre adiciona tie-breaker por codvenda desc para estabilidade
  return `ORDER BY ${col} ${dir}, v."codvenda" DESC`;
}

/**
 * Retorna SQL de ORDER BY para drafts (dbvenda_draft)
 * Atenção: 'codvenda' em drafts é draft_id (já projetado como alias "codvenda").
 * Podemos ordenar pelo alias com segurança.
 */
function buildOrderDraft(
  key: ReturnType<typeof normalizeSort>['key'],
  dir: 'ASC' | 'DESC',
) {
  const map: Record<string, string> = {
    codvenda: `"codvenda"`, // alias CAST(draft_id AS text)
    data: `d."updated_at"`,
    total: `"total"`, // alias calculado no SELECT
    status: `"status"`, // constante 'S'
    codcli: `d."codcli"`,
  };
  const col = map[key] ?? `d."updated_at"`;
  return `ORDER BY ${col} ${dir}, "codvenda" DESC`;
}

/**
 * Comparator JS quando precisamos ordenar em memória (para listas unificadas).
 */
function makeMemoryComparator(
  key: ReturnType<typeof normalizeSort>['key'],
  dir: 'ASC' | 'DESC',
) {
  const mult = dir === 'ASC' ? 1 : -1;
  return (a: any, b: any) => {
    const av = a?.[key];
    const bv = b?.[key];

    if (key === 'data') {
      const da = av ? new Date(av).getTime() : 0;
      const db = bv ? new Date(bv).getTime() : 0;
      if (da !== db) return (da - db) * mult;
      // tie-break por codvenda desc
      return -String(a.codvenda).localeCompare(String(b.codvenda));
    }

    // números (total) ou strings (codvenda/status/codcli)
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return (av - bv) * mult;
      return -String(a.codvenda).localeCompare(String(b.codvenda));
    }

    // tenta comparar como números se possível
    const na = Number(av);
    const nb = Number(bv);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
      return (na - nb) * mult;
    }

    // fallback string
    const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    if (cmp !== 0) return cmp * mult;
    return -String(a.codvenda).localeCompare(String(b.codvenda));
  };
}

/* ================== QUERIES ================== */

async function queryOnlyDrafts(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
  page: number,
  perPage: number,
  orderSql?: string, // 🔹 novo
) {
  const countSql = `SELECT COUNT(*)::bigint AS total FROM "dbvenda_draft" ${whereObj.where};`;
  const countRes = await client.query(countSql, whereObj.params);
  const total = Number(countRes.rows[0]?.total ?? 0);

  const listSql = `
    SELECT
      CAST(d."draft_id" AS text) AS "codvenda",
      d."codusr",
      d."codcli",
      d."updated_at"              AS "data",
      COALESCE(
        NULLIF(d."total", 0),
        (
          SELECT COALESCE(SUM(
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
          ),0)
          FROM jsonb_array_elements(COALESCE(d."payload"->'itens','[]'::jsonb)) i
        )
      )                           AS "total",
      'S'::char(1)                AS "status",
      'SALVA'                     AS "tipoOrigem",
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
      d."codusr",
      d."codcli",
      d."updated_at"              AS "data",
      COALESCE(
        NULLIF(d."total", 0),
        (
          SELECT COALESCE(SUM(
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
          ),0)
          FROM jsonb_array_elements(COALESCE(d."payload"->'itens','[]'::jsonb)) i
        )
      )                           AS "total",
      'S'::char(1)                AS "status",
      'SALVA'                     AS "tipoOrigem",
      d."label"
    FROM "dbvenda_draft" d
    ${whereObj.where}
    ORDER BY d."updated_at" DESC, "codvenda" DESC
  `;
  const res = await client.query(sql, whereObj.params);
  return res.rows;
}

async function queryOnlyVendas(
  client: PoolClient,
  whereObj: { where: string; params: any[] },
  page: number,
  perPage: number,
  orderSql?: string, // 🔹 novo
) {
  const countSql = `SELECT COUNT(*)::bigint AS total FROM "dbvenda" ${whereObj.where};`;
  const countRes = await client.query(countSql, whereObj.params);
  const total = Number(countRes.rows[0]?.total ?? 0);
  const listSql = `
    SELECT
      v."codvenda"::text         AS "codvenda",
      v."codusr",
      v."codcli",
      v."data",
      v."total",
      v."status",
      'VENDA'                    AS "tipoOrigem"
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
      v."codvenda"::text         AS "codvenda",
      v."codusr",
      v."codcli",
      v."data",
      v."total",
      v."status",
      'VENDA'                    AS "tipoOrigem"
    FROM "dbvenda" v
    ${whereObj.where}
    ORDER BY v."data" DESC, v."codvenda" DESC
  `;
  const res = await client.query(sql, whereObj.params);
  return res.rows;
}

function paginarArray<T>(arr: T[], page: number, perPage: number) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const data = arr.slice(start, end);
  return { data, meta: { total, totalPages, currentPage, perPage } };
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

/* ---------------------------------------------------- */
async function hydrateRows(client: PoolClient, rows: any[]) {
  if (!rows || rows.length === 0) return rows;

  const vendaIds: string[] = rows.map((v: any) => String(v.codvenda));
  const clientIds: string[] = rows
    .map((v: any) => v.codcli)
    .filter((c: any): c is string => !!c)
    .map((c: any) => String(c));

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
    ) as dbprod 
    FROM dbitvenda di 
    JOIN dbprod dp ON di.codprod = dp.codprod 
    LEFT JOIN dbmarcas dm ON dp.codmarca = dm.codmarca 
    WHERE di.codvenda = ANY($1::text[]) 
  `;
  const draftsFullQuery = `
    SELECT CAST(draft_id AS text) AS codvenda, draft_id, filial, codusr, codcli, tipo, arm_id, cliente_nome, label, itens_count, total, status, created_at, updated_at, expires_at, payload, codvend
    FROM dbvenda_draft
    WHERE CAST(draft_id AS text) = ANY($1::text[])
  `;
  const clientesQuery = ` 
    SELECT codcli, nome, nomefant 
    FROM dbclien 
    WHERE codcli = ANY($1::text[]) 
  `;

  const [itensFinalizados, draftsFull, clientes] = await Promise.all([
    client.query(itensFinalizadosQuery, [vendaIds]),
    client.query(draftsFullQuery, [vendaIds]),
    client.query(clientesQuery, [clientIds]),
  ]);

  const itensMap = new Map<string, any[]>();
  for (const r of itensFinalizados.rows) {
    const key = String(r.codvenda);
    if (!itensMap.has(key)) itensMap.set(key, []);
    itensMap.get(key)!.push(r);
  }
  const draftsMap = new Map<string, any>(
    draftsFull.rows.map((d: any) => [String(d.codvenda), d]),
  );
  const clientesMap = new Map<string, any>(
    clientes.rows.map((c: any) => [String(c.codcli), c]),
  );

  rows.forEach((v: any) => {
    const id = String(v.codvenda);
    const isDraft =
      v?.tipoOrigem === 'SALVA' ||
      v?.tipoOrigem === 'SALVA2' ||
      v?.status === 'S';

    v.dbclien = v.codcli ? clientesMap.get(String(v.codcli)) || null : null;

    if (isDraft) {
      const d = draftsMap.get(id) || null;
      v.draft = d;

      if (v.draft) {
        const hdr = v.draft?.payload?.header || {};
        const prazos = Array.isArray(v.draft?.payload?.prazos)
          ? v.draft.payload.prazos
          : [];

        v.draft.header = hdr;
        v.draft.prazos = prazos;

        v.draft.draft_id = v.draft.draft_id ?? hdr.draft_id ?? null;
        v.draft.codcli = v.draft.codcli ?? v.codcli ?? hdr.codcli ?? null;
        v.draft.codusr = v.draft.codusr ?? v.codusr ?? hdr.codusr ?? null;
        v.draft.codvend = v.draft.codvend ?? hdr.vendedor ?? null;
      }

      const itensCru: any[] = Array.isArray(d?.payload?.itens)
        ? d.payload.itens
        : [];

      const itensEnriquecidos = itensCru.map((i: any) => {
        const qtd = Number(i.qtd ?? i.quantidade ?? i.quantidadeNum ?? 0);
        const unit = Number(
          i.precoItemEditado ??
            i['preço'] ??
            i.preco ??
            i.prunit ??
            i.precoUnitario ??
            0,
        );
        const tot =
          Number(i.vltotalItem ?? i.totalItem ?? 0) ||
          Math.round(qtd * unit * 100) / 100;
        const unitStr = String(unit);
        const totStr = String(tot);

        return {
          ...i,
          prunit: unitStr,
          preco_unit: unitStr,
          vlunit: unitStr,
          vlrunit: unitStr,
          prvenda: unitStr,
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

      if (v.label == null && d?.label != null) v.label = d.label;
    } else {
      v.itens = itensMap.get(id) || [];
      v.dbitvenda = v.itens;
      v.draft = null;
    }
  });

  return rows;
}
/* ---------------------------------------------------- */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let client: PoolClient | undefined;

  try {
    // ✅ multi-bancos via cookie de filial
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

    // 🔹 normaliza a ordenação pedida
    const { key: sortKey, dir: sortDir } = normalizeSort(
      req.query.sortBy,
      req.query.sortDir,
    );
    const orderVendaSql = buildOrderVenda(sortKey, sortDir);
    const orderDraftSql = buildOrderDraft(sortKey, sortDir);

    if (!codusr) {
      return res.status(200).json({ data: [], meta: mkMeta(0, page, perPage) });
    }

    // --- SALVA (exclui tipo = 'E') ---
    if (statusFront === 'salva') {
      const draftWhere = buildWhereClauseDraft({
        codvenda: codvendaFilter,
        codusr,
        excludeTipoE: true,
      });

      const { total, rows } = await queryOnlyDrafts(
        client,
        draftWhere,
        page,
        perPage,
        orderDraftSql, // 🔹 ordenação dinâmica
      );
      const hydrated = await hydrateRows(client, rows);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta: mkMeta(total, page, perPage),
      });
    }

    // --- TODAS (salva sem E + salva2 (E) + F + N + B) ---
    if (statusFront === 'todas') {
      const draftsSemE = await queryDraftsRaw(
        client,
        buildWhereClauseDraft({
          codvenda: codvendaFilter,
          codusr,
          excludeTipoE: true,
        }),
      );
      const draftsE = await queryDraftsRaw(
        client,
        buildWhereClauseDraft({ codvenda: codvendaFilter, codusr, tipo: 'E' }),
      );
      const vendasFNB = await queryVendasRaw(
        client,
        buildWhereClauseVendaMulti({
          codvenda: codvendaFilter,
          codusr,
          statusIn: ['F', 'N', 'B'],
        }),
      );

      const merged = mergeUniqueByCodvenda(draftsSemE, draftsE, vendasFNB);

      // 🔹 ordena conforme a escolha do usuário
      merged.sort(makeMemoryComparator(sortKey, sortDir));

      const { data, meta } = paginarArray(merged, page, perPage);

      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    // --- SALVA2 (somente tipo = 'E') ---
    if (statusFront === 'salva2') {
      const draftWhere = buildWhereClauseDraft({
        codvenda: codvendaFilter,
        codusr,
        tipo: 'E',
      });
      const rows = await queryDraftsRaw(client, draftWhere);

      // 🔹 ordena conforme a escolha do usuário
      rows.sort(makeMemoryComparator(sortKey, sortDir));

      const { data, meta } = paginarArray(rows, page, perPage);

      // força o tipoOrigem para SALVA2 apenas nesta rota
      for (const r of data) r.tipoOrigem = 'SALVA2';

      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    // --- BLOQUEADA (dbvenda status = 'B') ---
    if (statusFront === 'bloqueada') {
      const vendaWhere = buildWhereClauseVenda({
        codvenda: codvendaFilter,
        codusr,
        status: 'B',
      });
      const { total, rows } = await queryOnlyVendas(
        client,
        vendaWhere,
        page,
        perPage,
        orderVendaSql, // 🔹 ordenação dinâmica
      );
      const hydrated = await hydrateRows(client, rows);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta: mkMeta(total, page, perPage),
      });
    }

    // --- COMBINADAS (salva EXCETO 'E' + F + N) ---
    if (statusFront === 'combinadas') {
      const draftsSemE = await queryDraftsRaw(
        client,
        buildWhereClauseDraft({
          codvenda: codvendaFilter,
          codusr,
          excludeTipoE: true,
        }),
      );
      const vendasFN = await queryVendasRaw(
        client,
        buildWhereClauseVendaMulti({
          codvenda: codvendaFilter,
          codusr,
          statusIn: ['F', 'N'],
        }),
      );

      const merged = mergeUniqueByCodvenda(draftsSemE, vendasFN);

      // 🔹 ordena conforme a escolha do usuário
      merged.sort(makeMemoryComparator(sortKey, sortDir));

      const { data, meta } = paginarArray(merged, page, perPage);

      const hydrated = await hydrateRows(client, data);
      return res.status(200).json({
        data: serializeBigInt(hydrated),
        meta,
      });
    }

    // Demais: faturada/finalizada/cancelada
    const dbStatus = mapStatusToDb(statusFront);
    const vendaWhere = buildWhereClauseVenda({
      codvenda: codvendaFilter,
      codusr,
      status: dbStatus,
    });
    const { total, rows } = await queryOnlyVendas(
      client,
      vendaWhere,
      page,
      perPage,
      orderVendaSql, // 🔹 ordenação dinâmica
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
