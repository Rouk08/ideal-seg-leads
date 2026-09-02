import type { Request, Response } from 'express';
import { createInteractionSchema } from './interactions.validators';
import * as interactionsService from './interactions.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const items = await interactionsService.list(req.user!, req.params.clienteId);
  res.json({ items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createInteractionSchema.parse(req.body);
  const interacao = await interactionsService.create(req.user!, req.params.clienteId, input);
  res.status(201).json(interacao);
});
