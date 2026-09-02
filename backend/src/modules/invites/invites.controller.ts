import type { Request, Response } from 'express';
import { createInviteSchema, acceptInviteSchema } from './invites.validators';
import * as invitesService from './invites.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createInviteSchema.parse(req.body);
  const result = await invitesService.createInvite(req.user!.id, input);
  res.status(201).json(result);
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const invites = await invitesService.listInvites();
  res.json({ invites });
});

export const revoke = asyncHandler(async (req: Request, res: Response) => {
  await invitesService.revokeInvite(req.params.id, req.user!.id);
  res.status(204).send();
});

// Rota pública (sem auth) — usada pela tela de "aceitar convite" antes de
// o usuário ter qualquer sessão.
export const validate = asyncHandler(async (req: Request, res: Response) => {
  const data = await invitesService.validateInviteToken(String(req.query.token ?? ''));
  res.json(data);
});

export const accept = asyncHandler(async (req: Request, res: Response) => {
  const input = acceptInviteSchema.parse(req.body);
  const usuario = await invitesService.acceptInvite(input);
  res.status(201).json({ usuario });
});
