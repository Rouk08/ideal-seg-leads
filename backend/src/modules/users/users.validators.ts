import { z } from 'zod';
import { Perfil } from '@prisma/client';

export const listUsersQuerySchema = z.object({
  perfil: z.nativeEnum(Perfil).optional(),
  ativo: z.coerce.boolean().optional(),
});

// Nunca inclui email nem senha aqui de propósito — troca de e-mail é uma
// mudança de identidade (fora de escopo) e senha só se altera pelo próprio
// usuário (ainda sem tela nesta versão) ou pelo fluxo de convite.
export const updateUserSchema = z
  .object({
    nome: z.string().trim().min(2).optional(),
    perfil: z.nativeEnum(Perfil).optional(),
    ativo: z.boolean().optional(),
    metaMensal: z.number().nonnegative().nullable().optional(),
    percentualComissao: z.number().min(0).max(100).nullable().optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
