import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { recordAudit } from '../../lib/audit';
import { hashPassword } from '../auth/auth.service';
import type { CreateUserInput, UpdateUserInput } from './users.validators';

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

// Criação direta pelo ADMIN — sem convite, sem token, sem e-mail de ativação.
// O ADMIN define a senha na hora e repassa pro colaborador (ex.: verbalmente
// ou por WhatsApp), mesmo fluxo já usado no ERP.
export async function create(adminId: string, input: CreateUserInput) {
  const email = input.email.toLowerCase().trim();

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    throw new HttpError(409, 'Já existe um usuário com este e-mail');
  }

  const senhaHash = await hashPassword(input.senha);

  const criado = await prisma.usuario.create({
    data: {
      nome: input.nome,
      email,
      senhaHash,
      perfil: input.perfil,
      ativo: true,
    },
    select: SELECT_PUBLICO,
  });

  await recordAudit({
    usuarioId: adminId,
    acao: 'usuario.criar',
    entidade: 'Usuario',
    entidadeId: criado.id,
    depois: { email: criado.email, perfil: criado.perfil },
  });

  return criado;
}

// Reset de senha pelo ADMIN — substitui o antigo fluxo de "esqueci minha
// senha" via convite: o admin define uma senha nova diretamente pro
// colaborador que perdeu acesso.
export async function resetPassword(adminId: string, id: string, senha: string) {
  const atual = await prisma.usuario.findUnique({ where: { id } });
  if (!atual) {
    throw new HttpError(404, 'Usuário não encontrado');
  }

  const senhaHash = await hashPassword(senha);
  await prisma.usuario.update({ where: { id }, data: { senhaHash } });

  await recordAudit({
    usuarioId: adminId,
    acao: 'usuario.redefinir_senha',
    entidade: 'Usuario',
    entidadeId: id,
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
