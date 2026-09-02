import type { Perfil } from '@prisma/client';

// Estende o Request do Express para carregar o usuário autenticado,
// preenchido pelo middleware requireAuth.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        perfil: Perfil;
      };
    }
  }
}

export {};
