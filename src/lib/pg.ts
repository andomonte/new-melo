// src/lib/pg.ts
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPoolSingle__: Pool | undefined;
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

function createPool(): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
    // Configurar timeout na sessão
    client.query('SET statement_timeout = 60000').catch(() => {});
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

// Helper para executar queries com garantia de liberação de conexão
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
