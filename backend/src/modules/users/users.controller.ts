import type { Request, Response } from 'express';
import {
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  updateUserSchema,
} from './users.validators';
import * as usersService from './users.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = listUsersQuerySchema.parse(req.query);
  const usuarios = await usersService.list(filters);
  res.json({ usuarios });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const usuario = await usersService.create(req.user!.id, input);
  res.status(201).json(usuario);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const usuario = await usersService.update(req.user!.id, req.params.id, input);
  res.json(usuario);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { senha } = resetPasswordSchema.parse(req.body);
  await usersService.resetPassword(req.user!.id, req.params.id, senha);
  res.status(204).send();
});
