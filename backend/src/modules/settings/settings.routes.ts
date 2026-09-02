import { Router } from 'express';
import * as settingsController from './settings.controller';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.get('/', requireRole('SUPERVISOR', 'ADMIN'), settingsController.get);
settingsRouter.patch('/', requireRole('ADMIN'), settingsController.update);
