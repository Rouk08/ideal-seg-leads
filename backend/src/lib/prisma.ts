import { PrismaClient } from '@prisma/client';

// Instância única do Prisma Client, reaproveitada em toda a aplicação
// (evita esgotar o pool de conexões do Postgres abrindo um client por request).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
