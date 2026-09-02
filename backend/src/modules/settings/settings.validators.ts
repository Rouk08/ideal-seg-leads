import { z } from 'zod';

export const updateSettingsSchema = z.object({
  diasReservaCarteira: z.number().int().min(1).max(365),
});
