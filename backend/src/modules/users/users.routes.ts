import { Router } from 'express';
import * as usersController from './users.controller';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// SUPERVISOR também lista usuários (precisa ver vendedores pra reatribuir
// carteira), mas só ADMIN edita — perfil, ativo/inativo, meta e comissão
// são dados sensíveis o bastante pra ficar restritos.
usersRouter.get('/', requireRole('SUPERVISOR', 'ADMIN'), usersController.list);
usersRouter.post('/', requireRole('ADMIN'), usersController.create);
usersRouter.patch('/:id', requireRole('ADMIN'), usersController.update);
usersRouter.post('/:id/redefinir-senha', requireRole('ADMIN'), usersController.resetPassword);
