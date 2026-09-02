import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { requireAuth, requireRole } from '../../middlewares/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, requireRole('SUPERVISOR', 'ADMIN'), dashboardController.stats);
