import type { Request, Response } from 'express';
import { listUsersQuerySchema, updateUserSchema } from './users.validators';
import * as usersService from './users.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listUsersQuerySchema.parse(req.query);
  const usuarios = await usersService.list(filters);
  res.json({ usuarios });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const usuario = await usersService.update(req.user!.id, req.params.id, input);
  res.json(usuario);
});
