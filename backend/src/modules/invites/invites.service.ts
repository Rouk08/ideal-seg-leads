import { InviteStatus, type Invite } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { generateOpaqueToken, hashOpaqueToken } from '../../lib/crypto';
import { hashPassword } from '../auth/auth.service';
import { HttpError } from '../../middlewares/errorHandler';
import { recordAudit } from '../../lib/audit';
import type { CreateInviteInput } from './invites.validators';

function buildInviteLink(rawToken: string): string {
  return `${env.APP_URL}/aceitar-convite?token=${rawToken}`;
}

export async function createInvite(criadoPorId: string, input: CreateInviteInput) {
  const email = input.email.toLowerCase().trim();

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioExistente) {
    throw new HttpError(409, 'Já existe um usuário cadastrado com este e-mail');
  }

  // Invalida convites pendentes anteriores para o mesmo e-mail, para nunca
  // existir mais de um token válido simultâneo apontando pro mesmo convidado.
  await prisma.invite.updateMany({
    where: { email, status: InviteStatus.PENDENTE },
    data: { status: InviteStatus.REVOGADO },
  });

  const { raw, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.INVITE_EXPIRES_IN_HOURS * 60 * 60 * 1000);

  const invite = await prisma.invite.create({
    data: {
      email,
      nome: input.nome,
      perfil: input.perfil,
      tokenHash: hash,
      expiresAt,
      criadoPorId,
    },
  });

  await recordAudit({
    usuarioId: criadoPorId,
    acao: 'convite.criar',
    entidade: 'Invite',
    entidadeId: invite.id,
    depois: { email, perfil: input.perfil, expiresAt },
  });

  return { invite: sanitizeInvite(invite), link: buildInviteLink(raw) };
}

export async function listInvites() {
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    include: { criadoPor: { select: { nome: true } } },
  });
  return invites.map(sanitizeInvite);
}

export async function revokeInvite(id: string, revogadoPorId: string) {
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) {
    throw new HttpError(404, 'Convite não encontrado');
  }
  if (invite.status !== InviteStatus.PENDENTE) {
    throw new HttpError(400, 'Só é possível revogar convites pendentes');
  }

  await prisma.invite.update({ where: { id }, data: { status: InviteStatus.REVOGADO } });

  await recordAudit({
    usuarioId: revogadoPorId,
    acao: 'convite.revogar',
    entidade: 'Invite',
    entidadeId: id,
  });
}

/**
 * Busca o convite pelo token cru e valida status/expiração sem consumi-lo —
 * usado pela tela de "aceitar convite" para exibir e-mail/nome antes do
 * usuário definir a senha.
 */
export async function validateInviteToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  const invite = await prisma.invite.findUnique({ where: { tokenHash } });

  if (!invite) {
    throw new HttpError(404, 'Convite não encontrado');
  }

  if (invite.status === InviteStatus.PENDENTE && invite.expiresAt < new Date()) {
    await prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.EXPIRADO } });
    throw new HttpError(410, 'Convite expirado. Peça ao administrador para gerar um novo.');
  }

  if (invite.status !== InviteStatus.PENDENTE) {
    throw new HttpError(410, 'Convite já utilizado ou revogado');
  }

  return { email: invite.email, nome: invite.nome, perfil: invite.perfil };
}

interface AcceptInviteData {
  token: string;
  nome: string;
  senha: string;
}

/**
 * Aceita o convite e cria o usuário. A troca de status PENDENTE -> USADO é
 * feita como parte da condição do update (não um find seguido de update),
 * para que duas requisições simultâneas com o mesmo token nunca consigam
 * criar dois usuários — a segunda sempre encontra 0 linhas afetadas.
 */
export async function acceptInvite(data: AcceptInviteData) {
  const tokenHash = hashOpaqueToken(data.token);

  const invite = await prisma.invite.findUnique({ where: { tokenHash } });
  if (!invite) {
    throw new HttpError(404, 'Convite não encontrado');
  }
  if (invite.expiresAt < new Date() && invite.status === InviteStatus.PENDENTE) {
    await prisma.invite.update({ where: { id: invite.id }, data: { status: InviteStatus.EXPIRADO } });
    throw new HttpError(410, 'Convite expirado. Peça ao administrador para gerar um novo.');
  }

  const senhaHash = await hashPassword(data.senha);

  const usuario = await prisma.$transaction(async (tx) => {
    // status PENDENTE e ainda dentro da validade fazem parte da própria
    // condição do update — cobre tanto o duplo-aceite simultâneo quanto o
    // caso de o token expirar exatamente entre a checagem acima e aqui.
    const updated = await tx.invite.updateMany({
      where: { id: invite.id, status: InviteStatus.PENDENTE, expiresAt: { gte: new Date() } },
      data: { status: InviteStatus.USADO, usedAt: new Date() },
    });

    if (updated.count === 0) {
      throw new HttpError(410, 'Convite já utilizado, revogado ou expirado');
    }

    const novoUsuario = await tx.usuario.create({
      data: {
        nome: data.nome,
        email: invite.email,
        senhaHash,
        perfil: invite.perfil,
      },
    });

    await tx.invite.update({ where: { id: invite.id }, data: { usuarioGeradoId: novoUsuario.id } });

    return novoUsuario;
  });

  await recordAudit({
    usuarioId: usuario.id,
    acao: 'convite.aceitar',
    entidade: 'Usuario',
    entidadeId: usuario.id,
    depois: { email: usuario.email, perfil: usuario.perfil },
  });

  return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

function sanitizeInvite(invite: Invite & { criadoPor?: { nome: string } }) {
  // tokenHash nunca sai da camada de serviço para fora
  const { tokenHash: _tokenHash, ...rest } = invite;
  return rest;
}
