// src/lib/pg.ts
import { Pool, types } from 'pg';
import { createHash } from 'crypto';
import type { NextApiRequest } from 'next';
import { decrypt } from '@/utils/crypto';

// TIMEZONE FIX: O driver pg converte date/timestamp usando o timezone do processo Node.
// Na Vercel (UTC), isso faz datas aparecerem 1 dia atrás no browser de Manaus (UTC-4).
// Solução: retornar datas como strings brutas, sem conversão automática.
// O frontend formata explicitamente.
types.setTypeParser(1082, (val: string) => val); // date → 'yyyy-mm-dd' (sem conversão para Date)
types.setTypeParser(1114, (val: string) => val); // timestamp without tz → string bruta
types.setTypeParser(1184, (val: string) => val); // timestamp with tz → string bruta

declare global {
  // eslint-disable-next-line no-var
  var __pgPoolSingle__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgPoolsBySchema__: Record<string, Pool> | undefined;
  // eslint-disable-next-line no-var
  var __schemaFilialCache__: { at: number; map: Record<string, any> } | undefined;
}

/**
 * Pool único (fixo), independente de filial.
 * Usa DATABASE_URL_APP (preferencial) ou DATABASE_URL (fallback).
 * Mantém o mesmo nome de função: getPgPool().
 *
 * IMPORTANTE: Usa variável global para sobreviver aos hot reloads do Next.js
 */
export function getPgPool(): Pool {
  // Em desenvolvimento, usar global para evitar múltiplos pools com hot reload
  if (process.env.NODE_ENV === 'development') {
    if (!global.__pgPoolSingle__) {
      global.__pgPoolSingle__ = createPool();
    }
    return global.__pgPoolSingle__;
  }

  // Em produção, usar variável local do módulo
  if (!modulePool) {
    modulePool = createPool();
  }
  return modulePool;
}

// Pool para produção (variável local do módulo)
let modulePool: Pool | null = null;

// Schema central (banco de login/cadastros base). Toda conexão do pool
// central deve nascer com este search_path.
// OBS: sem espaço entre os schemas — no parâmetro "options" do libpq o espaço
// separa argumentos e quebra o valor (ex.: "db_manaus," inválido).
// Schema ativo — configurável por ambiente. Produção/homolog: db_manaus (default).
// Localhost de teste: DB_SCHEMA=db_rondonia (filial de testes, descartável).
// Como as queries passam a ser SEM prefixo de schema, o search_path resolve tudo.
export const DB_SCHEMA = process.env.DB_SCHEMA || 'db_manaus';
const SEARCH_PATH_CENTRAL = `${DB_SCHEMA},public`;

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // IMPORTANTE: fixa o search_path no handshake (modo libpq). O parâmetro
    // "schema=" que vem na connection string é IGNORADO pelo node-postgres,
    // então dependíamos do default do role. Aqui garantimos db_manaus em
    // TODA conexão física nova, independente da URL.
    options: `-c search_path=${SEARCH_PATH_CENTRAL}`,
    max: 20, // Reduzido para evitar esgotar conexões
    min: 2, // Menos conexões ociosas
    idleTimeoutMillis: 10000, // 10 segundos - fechar conexões ociosas mais rápido
    connectionTimeoutMillis: 10000, // 10 segundos para conectar
    statement_timeout: 60000, // 60 segundos para queries
    query_timeout: 60000, // 60 segundos
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    allowExitOnIdle: true, // Permitir fechar conexões ociosas
  });

  // Event handlers para debug
  pool.on('error', (err) => {
    console.error('❌ Erro no pool:', err.message);
  });

  pool.on('connect', (client) => {
    // Reforço (belt-and-suspenders): garante timeout e search_path corretos
    // em cada conexão física nova, além do que já vem via options.
    client.query('SET statement_timeout = 60000').catch(() => {});
    client
      .query(`SET search_path TO ${SEARCH_PATH_CENTRAL}`)
      .catch(() => {});
  });

  return pool;
}

export async function endPgPool() {
  if (process.env.NODE_ENV === 'development') {
    if (global.__pgPoolSingle__) {
      await global.__pgPoolSingle__.end();
      global.__pgPoolSingle__ = undefined;
    }
  } else {
    if (modulePool) {
      await modulePool.end();
      modulePool = null;
    }
  }
}

// Função para monitorar o pool
export function getPoolStats() {
  const pool = process.env.NODE_ENV === 'development'
    ? global.__pgPoolSingle__
    : modulePool;

  if (!pool) return null;

  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

// Log periódico do estado do pool (apenas em desenvolvimento)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = getPoolStats();
    // if (stats && stats.total > 0) {
    //   // console.log(`📊 Pool: ${stats.total} total, ${stats.idle} idle, ${stats.waiting} waiting`);
    // }
  }, 30000); // A cada 30 segundos
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-FILIAL: pool de DADOS resolvido por filial (data-driven via tb_filial)
//
// Regra de negócio: só o ACESSO/ACL é central (db_manaus). Cadastros E movimento
// são por filial. O vínculo filial→banco vem do BANCO (tb_filial), não de env/
// código, então criar filial nova não exige deploy: basta cadastrar a filial com
// sua conexão + schema.
//
// Dois campos em tb_filial:
//  - db_conn_enc : string de conexão COMPLETA da filial, criptografada (AES, via
//                  utils/crypto). Em DEV as filiais dividem o mesmo servidor, então
//                  fica NULL → usa a DATABASE_URL padrão. Em PROD cada filial terá
//                  seu servidor local → aqui vem a conexão dela.
//  - schema_db   : search_path. DEV: db_rondonia/db_roraima. PROD (banco próprio): public.
//
// Compatibilidade: sem filial, ou filial sem conexão/schema → pool central
// (db_manaus), mesmo comportamento de hoje. Permite migrar tela a tela.
// ─────────────────────────────────────────────────────────────────────────────

// Só aceita nomes de schema no padrão db_<algo>/public — evita injeção no options.
const SCHEMA_SEGURO_RX = /^(db_[a-z0-9_]+|public)$/;

interface FilialConexao {
  schema: string | null;
  connEnc: string | null; // string de conexão criptografada (ou null = usa padrão)
}

/**
 * Pool para uma (conexão + schema). Cacheado por assinatura (hash), pois a
 * conexão pode conter senha — não usamos a string crua como chave de cache.
 */
async function poolParaConexao(info: FilialConexao): Promise<Pool> {
  const schemaOk =
    info.schema && SCHEMA_SEGURO_RX.test(info.schema) ? info.schema : DB_SCHEMA;
  const searchPath = `${schemaOk},public`;

  // Sem conexão própria E schema central → reaproveita o pool central.
  if (!info.connEnc && schemaOk === DB_SCHEMA) return getPgPool();

  // Decripta a conexão (se houver) só quando for montar um pool novo.
  let connectionString = process.env.DATABASE_URL as string;
  if (info.connEnc) {
    const dec = await decrypt(info.connEnc);
    if (dec) connectionString = dec;
  }

  const sig = createHash('sha256')
    .update(`${connectionString}::${searchPath}`)
    .digest('hex');

  const pools = (global.__pgPoolsBySchema__ ??= {});
  if (!pools[sig]) {
    const pool = new Pool({
      connectionString,
      options: `-c search_path=${searchPath}`,
      max: 10,
      min: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 60000,
      query_timeout: 60000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: true,
    });
    pool.on('error', (err) => console.error(`❌ Erro no pool ${schemaOk}:`, err.message));
    pool.on('connect', (client) => {
      client.query('SET statement_timeout = 60000').catch(() => {});
      client.query(`SET search_path TO ${searchPath}`).catch(() => {});
    });
    pools[sig] = pool;
  }
  return pools[sig];
}

/** Mapa filial(NOME maiúsculo) → {schema, connEnc}, lido de tb_filial (cache 60s). */
async function getMapaFilialConexao(): Promise<Record<string, FilialConexao>> {
  const cache = global.__schemaFilialCache__ as
    | { at: number; map: Record<string, FilialConexao> }
    | undefined;
  if (cache && Date.now() - cache.at < 60_000) return cache.map;
  const map: Record<string, FilialConexao> = {};
  try {
    // tb_filial vive no schema CENTRAL (db_manaus) — usa o pool central.
    const r = await getPgPool().query(
      `SELECT UPPER(nome_filial) AS nome, schema_db, db_conn_enc FROM tb_filial`,
    );
    for (const row of r.rows) {
      map[row.nome] = { schema: row.schema_db || null, connEnc: row.db_conn_enc || null };
    }
  } catch (e: any) {
    console.warn('getMapaFilialConexao falhou (fallback db_manaus):', e?.message);
  }
  (global as any).__schemaFilialCache__ = { at: Date.now(), map };
  return map;
}

/**
 * Invalida o cache filial→conexão. Chamar após criar/editar uma filial para que
 * a mudança de schema/conexão valha imediatamente (sem esperar o TTL de 60s).
 */
export function invalidarCacheFilial(): void {
  global.__schemaFilialCache__ = undefined;
}

/** Nome da filial da requisição, lido do cookie `filial_melo`. */
export function filialDaRequisicao(req: NextApiRequest): string {
  try {
    const raw = req.headers.cookie || '';
    const m = raw.match(/(?:^|;\s*)filial_melo=([^;]+)/);
    return m ? decodeURIComponent(m[1]).trim().toUpperCase() : '';
  } catch {
    return '';
  }
}

/**
 * Pool de DADOS pelo NOME da filial (ex.: 'RONDONIA'). Fallback db_manaus quando
 * vazio/desconhecido ou filial sem schema/conexão. Use quando o endpoint já
 * resolveu a filial (cookie/body/query) numa variável própria.
 */
export async function getPgPoolPorNomeFilial(nome: string): Promise<Pool> {
  const filial = String(nome || '').trim().toUpperCase();
  if (!filial) return getPgPool();
  const mapa = await getMapaFilialConexao();
  const info = mapa[filial];
  if (!info || (!info.schema && !info.connEnc)) return getPgPool();
  return poolParaConexao(info);
}

/**
 * Pool de DADOS da filial selecionada na requisição (lê o cookie filial_melo).
 * Fallback para o pool central (db_manaus) quando não há filial/conexão/schema —
 * 100% compatível com o comportamento atual, permitindo migração tela a tela.
 */
export async function getPgPoolFilial(req: NextApiRequest): Promise<Pool> {
  return getPgPoolPorNomeFilial(filialDaRequisicao(req));
}

// Helper para executar queries com garantia de liberação de conexão (pool CENTRAL).
export async function queryWithRelease<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    // SEMPRE libera a conexão, mesmo em caso de erro
    client.release();
  }
}

// Versão FILIAL-AWARE do queryWithRelease: resolve o pool pela filial da requisição.
export async function queryWithReleaseFilial<T = any>(
  req: NextApiRequest,
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const pool = await getPgPoolFilial(req);
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
