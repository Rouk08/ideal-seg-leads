import type { Request, Response } from 'express';
import { updateSettingsSchema } from './settings.validators';
import * as settingsService from './settings.service';
import { asyncHandler } from '../../middlewares/errorHandler';

export const get = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await settingsService.getSettings());
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const { diasReservaCarteira } = updateSettingsSchema.parse(req.body);
  res.json(await settingsService.updateSettings(req.user!.id, diasReservaCarteira));
});
