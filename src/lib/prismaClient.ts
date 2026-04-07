// ARQUIVO OBSOLETO - MIGRADO PARA PostgreSQL pg
// Este arquivo não é mais utilizado após a migração para pg nativo
// Use o arquivo '@/lib/pgClient' para multi-banco

/*
// lib/prismaClient.ts
import { PrismaClient } from '@prisma/client';

type PrismaMap = Record<string, PrismaClient>;

// Garante que a propriedade exista no globalThis
declare global {
  let prismaConnections: PrismaMap;
}

// Evita redefinição em dev (HMR)
globalThis.prismaConnections = globalThis.prismaConnections || {};

export function getPrisma(filial: string): PrismaClient {
  const key = filial.toLowerCase();
  const dbUrl = process.env[`DATABASE_URL_${key.toUpperCase()}`];

  if (!dbUrl) {
    throw new Error(`DATABASE_URL_${key.toUpperCase()} não definida no .env`);
  }
  
  if (!globalThis.prismaConnections[key]) {
    globalThis.prismaConnections[key] = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl.includes('connect_timeout')
            ? dbUrl
            : `${dbUrl}&connect_timeout=15`,
        },
      },
      log: ['error', 'warn'],
    });
  }
  
  return globalThis.prismaConnections[key];
}
*/

export function getPrisma(_filial: string): any {
  throw new Error('getPrisma está obsoleto. Use getPgPool de @/lib/pgClient');
}
