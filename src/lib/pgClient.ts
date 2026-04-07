// lib/pgClient.ts
import { Pool } from 'pg';

type PgPoolMap = Record<string, Pool>;

/**
 * DICA: em TS, prefira declarar a var como opcional no global e inicializar
 * sem precisar de @ts-expect-error.
 */
declare global {
  // eslint-disable-next-line no-var
  var pgPools: PgPoolMap | undefined;
}

/** Normaliza o nome recebido para compor o env-var: DATABASE_URL_<DBNAME> */
function toDbEnvKey(name: string): string {
  // Ex.: "Boa Vista" -> "BOA_VISTA"
  const dbName = String(name ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^\w]+/g, '_');
  return `DATABASE_URL_${dbName}`;
}

/** Retorna (ou cria) um Pool por chave estável. */
export function getPgPool(filialOrDbName: string): Pool {
  if (!filialOrDbName || !String(filialOrDbName).trim()) {
    throw new Error(
      `Filial inválida (string vazia/undefined) ao obter Pool PG.`,
    );
  }

  // Inicializa o cache de pools no escopo global (suporta HMR no Next)
  const pools = (globalThis.pgPools ??= {} as PgPoolMap);

  // A chave de cache deve ser estável e única por "tenant"
  const cacheKey = String(filialOrDbName).trim().toUpperCase();

  // Descobre o env-var a partir do nome dinâmico
  const envKey = toDbEnvKey(filialOrDbName);
  let dbUrl = process.env[envKey];

  // Fallback opcional (se quiser um default para dev/monotenant)
  if (!dbUrl && process.env.DATABASE_URL_DEFAULT) {
    dbUrl = process.env.DATABASE_URL_DEFAULT!;
  }

  if (!dbUrl) {
    throw new Error(
      `Variável de ambiente não encontrada: ${envKey} (nem DATABASE_URL_DEFAULT).`,
    );
  }

  if (!pools[cacheKey]) {
    // Garante connect_timeout, sem duplicar
    const conn = dbUrl.includes('connect_timeout')
      ? dbUrl
      : `${dbUrl}?connect_timeout=30`;

    pools[cacheKey] = new Pool({
      connectionString: conn,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      query_timeout: 30_000,
      allowExitOnIdle: true,
    });
  }

  return pools[cacheKey]!;
}

export async function endPgPool(filialOrDbName: string): Promise<void> {
  if (!filialOrDbName || !String(filialOrDbName).trim()) return;

  const pools = (globalThis.pgPools ??= {} as PgPoolMap);
  const cacheKey = String(filialOrDbName).trim().toUpperCase();

  if (pools[cacheKey]) {
    await pools[cacheKey].end();
    delete pools[cacheKey];
  }
}
