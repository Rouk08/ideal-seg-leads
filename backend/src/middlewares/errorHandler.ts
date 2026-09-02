import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Middleware de erro central: qualquer throw dentro de uma rota async
// (envolvida por asyncHandler) cai aqui, com um formato de resposta único.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', details: err.flatten() });
  }

  // eslint-disable-next-line no-console
  console.error('[erro não tratado]', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

// Evita repetir try/catch em toda rota async — encaminha qualquer rejeição
// para o errorHandler acima.
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
