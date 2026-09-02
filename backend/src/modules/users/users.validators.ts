import { z } from 'zod';
import { Perfil } from '@prisma/client';

export const listUsersQuerySchema = z.object({
  perfil: z.nativeEnum(Perfil).optional(),
  ativo: z.coerce.boolean().optional(),
});

// Criação direta pelo ADMIN — nome de usuário (e-mail) e senha definidos
// na hora, sem fluxo de convite/token. Pensado pra colaboradores que só
// precisam de um login simples pra usar o app (o ADMIN entrega a senha
// diretamente), mesmo padrão já usado no ERP.
export const createUserSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  email: z.string().trim().email('E-mail inválido'),
  senha: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres'),
  perfil: z.nativeEnum(Perfil).default(Perfil.VENDEDOR),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Nunca inclui email aqui de propósito — troca de e-mail é uma mudança de
// identidade, fora de escopo. Senha tem sua própria rota (reset direto
// pelo admin, ver resetPasswordSchema).
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

export const resetPasswordSchema = z.object({
  senha: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres'),
});
