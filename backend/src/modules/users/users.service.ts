import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { recordAudit } from '../../lib/audit';
import type { UpdateUserInput } from './users.validators';

const SELECT_PUBLICO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  metaMensal: true,
  percentualComissao: true,
  createdAt: true,
} as const;

export async function list(filters: { perfil?: string; ativo?: boolean }) {
  return prisma.usuario.findMany({
    where: {
      ...(filters.perfil ? { perfil: filters.perfil as never } : {}),
      ...(filters.ativo !== undefined ? { ativo: filters.ativo } : {}),
    },
    orderBy: { nome: 'asc' },
    select: SELECT_PUBLICO,
  });
}

export async function update(adminId: string, id: string, input: UpdateUserInput) {
  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  const atualizado = await prisma.usuario.update({
    where: { id },
    data: input,
    select: SELECT_PUBLICO,
  });

  // Desativar um vendedor NUNCA apaga os clientes dele (regra de negócio #7)
  // — isso já é garantido só por não existir nenhum cascade de exclusão daqui
  // pra Cliente; o update acima só toca a linha de Usuario.

  await recordAudit({
    usuarioId: adminId,
    acao: 'usuario.atualizar',
    entidade: 'Usuario',
    entidadeId: id,
    antes: { ativo: atual.ativo, perfil: atual.perfil },
    depois: { ativo: atualizado.ativo, perfil: atualizado.perfil },
  });

  return atualizado;
}
