import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Perfil } from '@prisma/client';
import { env } from '../config/env';
import { HttpError } from './errorHandler';

interface AccessTokenPayload {
  sub: string; // usuarioId
  perfil: Perfil;
}

/**
 * Exige um access token JWT válido no header Authorization: Bearer <token>.
 * Em caso de sucesso, popula req.user = { id, perfil } para as rotas e
 * middlewares seguintes usarem (em especial o isolamento por vendedor).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Token de acesso ausente');
  }

  const token = header.slice('Bearer '.length);

  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    throw new HttpError(401, 'Token de acesso inválido ou expirado');
  }

  req.user = { id: payload.sub, perfil: payload.perfil };
  next();
}

/**
 * Restringe a rota a um ou mais perfis. Deve vir sempre depois de requireAuth.
 * Ex.: router.post('/usuarios', requireAuth, requireRole('ADMIN'), ...)
 */
export function requireRole(...perfis: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new HttpError(401, 'Não autenticado');
    }
    if (!perfis.includes(req.user.perfil)) {
      throw new HttpError(403, 'Sem permissão para este recurso');
    }
    next();
  };
}
