import type { Request, Response } from 'express';
import {
  createClientSchema,
  updateClientSchema,
  reassignSchema,
  listClientsQuerySchema,
  checkDuplicateQuerySchema,
} from './clients.validators';
import * as clientsService from './clients.service';
import { asyncHandler, HttpError } from '../../middlewares/errorHandler';

function authUser(req: Request) {
  return req.user!;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = createClientSchema.parse(req.body);
  const cliente = await clientsService.create(authUser(req), input);
  res.status(201).json(cliente);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = listClientsQuerySchema.parse(req.query);
  const result = await clientsService.list(authUser(req), query);
  res.json(result);
});

export const checkDuplicate = asyncHandler(async (req: Request, res: Response) => {
  const { cnpjCpf } = checkDuplicateQuerySchema.parse(req.query);
  const result = await clientsService.checkDuplicate(cnpjCpf);
  res.json(result);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await clientsService.get(authUser(req), req.params.id);
  res.json(cliente);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const input = updateClientSchema.parse(req.body);
  const cliente = await clientsService.update(authUser(req), req.params.id, input);
  res.json(cliente);
});

export const reassign = asyncHandler(async (req: Request, res: Response) => {
  const { vendedorId } = reassignSchema.parse(req.body);
  const cliente = await clientsService.reassign(authUser(req), req.params.id, vendedorId);
  res.json(cliente);
});

export const uploadFoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new HttpError(400, 'Nenhum arquivo enviado');
  }
  const cliente = await clientsService.uploadFoto(authUser(req), req.params.id, req.file);
  res.json(cliente);
});

export const getFoto = asyncHandler(async (req: Request, res: Response) => {
  const { buffer, path } = await clientsService.getFotoBuffer(authUser(req), req.params.id);
  const ext = path.split('.').pop()?.toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.send(buffer);
});
