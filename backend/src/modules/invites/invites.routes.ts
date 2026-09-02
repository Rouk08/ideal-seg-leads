import { Router } from 'express';
import * as invitesController from './invites.controller';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const invitesRouter = Router();

// Rotas públicas — o convidado ainda não tem sessão nenhuma
invitesRouter.get('/validate', invitesController.validate);
invitesRouter.post('/accept', invitesController.accept);

// Rotas administrativas — só ADMIN gera/gerencia convites
invitesRouter.post('/', requireAuth, requireRole('ADMIN'), invitesController.create);
invitesRouter.get('/', requireAuth, requireRole('ADMIN'), invitesController.list);
invitesRouter.delete('/:id', requireAuth, requireRole('ADMIN'), invitesController.revoke);
