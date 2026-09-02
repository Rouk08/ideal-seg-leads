import { Router } from 'express';
import multer from 'multer';
import * as clientsController from './clients.controller';
import * as interactionsController from '../interactions/interactions.controller';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const clientsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

clientsRouter.use(requireAuth);

// Checagem de duplicidade ANTES de criar — usada pelo formulário em tempo real.
clientsRouter.get('/check-duplicate', clientsController.checkDuplicate);

// Precisa vir antes de '/:id' — senão "export" seria interpretado como um id.
// Mesmo isolamento do list() (buildWhere compartilhado): um vendedor só
// exporta os próprios clientes, nunca os de outro (critério de aceite).
clientsRouter.get('/export', clientsController.exportCsv);

clientsRouter.post('/', clientsController.create);
clientsRouter.get('/', clientsController.list);
clientsRouter.get('/:id', clientsController.get);
clientsRouter.patch('/:id', clientsController.update);

// Só supervisor/admin reatribuem carteira.
clientsRouter.patch('/:id/reassign', requireRole('SUPERVISOR', 'ADMIN'), clientsController.reassign);

clientsRouter.post('/:id/foto', upload.single('foto'), clientsController.uploadFoto);
clientsRouter.get('/:id/foto', clientsController.getFoto);

// Interações — sempre aninhadas a um cliente; o isolamento é herdado de lá
// (interactions.service verifica acesso ao cliente antes de qualquer coisa).
clientsRouter.get('/:clienteId/interacoes', interactionsController.list);
clientsRouter.post('/:clienteId/interacoes', interactionsController.create);
