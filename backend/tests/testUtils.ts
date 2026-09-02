import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Limpa só as tabelas usadas nesta etapa (auth/invites). CASCADE cobre
// refresh_tokens/invites que referenciam usuarios.
export async function cleanDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "invites", "usuarios" RESTART IDENTITY CASCADE',
  );
}
