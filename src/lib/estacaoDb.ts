import { Pool, types } from 'pg';

// Datas/timestamps como string bruta (mesmo tratamento de pg.ts/pgClient.ts)
types.setTypeParser(1082, (v: string) => v); // date
types.setTypeParser(1114, (v: string) => v); // timestamp
types.setTypeParser(1184, (v: string) => v); // timestamptz

/**
 * Roteamento de banco POR FILIAL para as telas soltas (Separação/Conferência/TV).
 *
 * Todos os schemas vivem no MESMO banco Postgres — então conectamos com a URL
 * principal (DATABASE_URL) e fixamos o search_path no schema da filial. Isso
 * troca o banco de verdade ao entrar/trocar de filial (o env DATABASE_URL_<FILIAL>
 * apontava errado e NÃO forçava search_path).
 *
 * Mapa igual ao do Caixa (migration 033): MANAUS→db_manaus, etc.
 */
const SCHEMA_POR_FILIAL: Record<string, string> = {
  MANAUS: 'db_manaus',
  RONDONIA: 'db_rondonia',
  RORAIMA: 'db_roraima',
};

export function schemaDaFilial(filial: string): string {
  return SCHEMA_POR_FILIAL[String(filial || '').trim().toUpperCase()] || 'db_manaus';
}

declare global {
  // eslint-disable-next-line no-var
  var __estacaoPools__: Record<string, Pool> | undefined;
}

/** Pool (cacheado por schema) conectado no schema da filial. */
export function poolDaFilial(filial: string): Pool {
  const schema = schemaDaFilial(filial);
  const pools = (globalThis.__estacaoPools__ ??= {});
  if (!pools[schema]) {
    pools[schema] = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
      max: 10,
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
  }
  return pools[schema]!;
}
