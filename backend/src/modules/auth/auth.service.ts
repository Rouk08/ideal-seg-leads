import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import type { Perfil, Usuario } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { generateOpaqueToken, hashOpaqueToken } from '../../lib/crypto';
import { HttpError } from '../../middlewares/errorHandler';
import { recordAudit } from '../../lib/audit';

const REFRESH_COOKIE_NAME = 'refresh_token';

export async function hashPassword(senha: string): Promise<string> {
  // argon2id: variante recomendada atualmente (resistente a GPU e side-channel)
  return argon2.hash(senha, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha);
}

function signAccessToken(usuario: Pick<Usuario, 'id' | 'perfil'>): string {
  return jwt.sign({ sub: usuario.id, perfil: usuario.perfil }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

async function issueRefreshToken(usuarioId: string, meta: RequestMeta) {
  const { raw, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      usuarioId,
      tokenHash: hash,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return { raw, expiresAt };
}

interface UsuarioPublico {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  metaMensal: unknown;
  percentualComissao: unknown;
}

interface AuthResult {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

// Campos do Usuario seguros para expor ao próprio front (nunca senhaHash).
// Um helper único aqui evita o que já aconteceu uma vez: adicionar um campo
// novo (metaMensal) só no /auth/me e esquecer de refletir em login/refresh.
function sanitizeUsuario(usuario: {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  metaMensal: unknown;
  percentualComissao: unknown;
}): UsuarioPublico {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    metaMensal: usuario.metaMensal,
    percentualComissao: usuario.percentualComissao,
  };
}

export async function login(email: string, senha: string, meta: RequestMeta): Promise<AuthResult> {
  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Mensagem genérica em ambos os casos (usuário não existe / senha errada / inativo)
  // para não revelar quais e-mails têm cadastro no sistema.
  const credenciaisInvalidas = () => new HttpError(401, 'E-mail ou senha inválidos');

  if (!usuario || !usuario.ativo) {
    throw credenciaisInvalidas();
  }

  const senhaOk = await verifyPassword(usuario.senhaHash, senha);
  if (!senhaOk) {
    throw credenciaisInvalidas();
  }

  const accessToken = signAccessToken(usuario);
  const { raw: refreshToken, expiresAt } = await issueRefreshToken(usuario.id, meta);

  await recordAudit({
    usuarioId: usuario.id,
    acao: 'usuario.login',
    entidade: 'Usuario',
    entidadeId: usuario.id,
    ip: meta.ip,
  });

  return {
    usuario: sanitizeUsuario(usuario),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

/**
 * Rotação de refresh token: o token atual é sempre revogado e um novo é
 * emitido, mesmo em uso normal. Isso permite detectar reuso de um token já
 * rotacionado (sinal de token roubado) — se um token revogado for
 * apresentado novamente, é tratado como inválido.
 */
export async function refresh(rawRefreshToken: string, meta: RequestMeta): Promise<AuthResult> {
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { usuario: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.usuario.ativo) {
    throw new HttpError(401, 'Sessão expirada, faça login novamente');
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = signAccessToken(stored.usuario);
  const { raw: refreshToken, expiresAt } = await issueRefreshToken(stored.usuarioId, meta);

  return {
    usuario: sanitizeUsuario(stored.usuario),
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = hashOpaqueToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export const cookies = {
  name: REFRESH_COOKIE_NAME,
  options: (maxAgeMs: number) => ({
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAgeMs,
    path: '/api/auth',
  }),
};
