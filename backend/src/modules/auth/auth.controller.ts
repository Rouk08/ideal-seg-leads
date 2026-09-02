import type { Request, Response } from 'express';
import { loginSchema } from './auth.validators';
import * as authService from './auth.service';
import { asyncHandler, HttpError } from '../../middlewares/errorHandler';
import { prisma } from '../../lib/prisma';

function meta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, senha } = loginSchema.parse(req.body);
  const result = await authService.login(email, senha, meta(req));

  res.cookie(
    authService.cookies.name,
    result.refreshToken,
    authService.cookies.options(result.refreshTokenExpiresAt.getTime() - Date.now()),
  );

  res.json({ usuario: result.usuario, accessToken: result.accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[authService.cookies.name];
  if (!rawRefreshToken) {
    throw new HttpError(401, 'Sessão não encontrada');
  }

  const result = await authService.refresh(rawRefreshToken, meta(req));

  res.cookie(
    authService.cookies.name,
    result.refreshToken,
    authService.cookies.options(result.refreshTokenExpiresAt.getTime() - Date.now()),
  );

  res.json({ usuario: result.usuario, accessToken: result.accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[authService.cookies.name];
  await authService.logout(rawRefreshToken);
  res.clearCookie(authService.cookies.name, { path: '/api/auth' });
  res.status(204).send();
});

// Usado pelo frontend para reidratar o usuário logado (ex.: após reload da PWA)
export const me = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.user!.id },
    select: { id: true, nome: true, email: true, perfil: true, ativo: true },
  });

  if (!usuario || !usuario.ativo) {
    throw new HttpError(401, 'Não autenticado');
  }

  res.json({ usuario });
});
