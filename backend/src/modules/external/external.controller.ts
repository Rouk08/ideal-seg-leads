import type { Request, Response } from 'express';
import * as brasilApi from './brasilApi.service';
import { asyncHandler, HttpError } from '../../middlewares/errorHandler';

export const cnpj = asyncHandler(async (req: Request, res: Response) => {
  const result = await brasilApi.lookupCnpj(req.params.cnpj);
  if (!result) {
    throw new HttpError(404, 'CNPJ não encontrado ou serviço indisponível — preencha manualmente');
  }
  res.json(result);
});

export const cep = asyncHandler(async (req: Request, res: Response) => {
  const result = await brasilApi.lookupCep(req.params.cep);
  if (!result) {
    throw new HttpError(404, 'CEP não encontrado ou serviço indisponível — preencha manualmente');
  }
  res.json(result);
});
