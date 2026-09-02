import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const stats = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await dashboardService.getStats());
});
