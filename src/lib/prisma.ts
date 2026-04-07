// NOTA: Este arquivo ainda é utilizado por algumas rotas API antigas
// Novas implementações devem usar pg nativo (@/lib/pg)

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ✅ Método para testar a conexão
export const isConnected = async (): Promise<boolean> => {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Erro ao testar a conexão Prisma:', error);
    return false;
  }
};

// ✅ Método para encerrar a conexão
export const forceDisconnectPrisma = async () => {
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error('Erro ao encerrar a conexão Prisma:', error);
    }
  }
};

export default prisma;
