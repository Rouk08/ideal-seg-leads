import { z } from 'zod';
import { Perfil } from '@prisma/client';

export const createInviteSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().min(2).optional(),
  // ADMIN não convida outro ADMIN por aqui de propósito — criação de admin
  // é uma operação sensível o bastante para ficar fora do fluxo de convite.
  perfil: z.enum([Perfil.VENDEDOR, Perfil.SUPERVISOR]).default(Perfil.VENDEDOR),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1, 'Token é obrigatório'),
    nome: z.string().min(2, 'Nome é obrigatório'),
    senha: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres'),
    confirmarSenha: z.string().min(8),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: 'As senhas não conferem',
    path: ['confirmarSenha'],
  });

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
