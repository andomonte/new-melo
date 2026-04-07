// types/global.d.ts
import { PrismaClient } from '@prisma/client';

declare global {
  interface GlobalThis {
    prismaConnections?: Record<string, PrismaClient>;
  }
}

export {};
