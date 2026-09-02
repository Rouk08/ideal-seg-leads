import { z } from 'zod';
import { TipoInteracao } from '@prisma/client';

export const createInteractionSchema = z.object({
  id: z.string().uuid().optional(), // gerado no device na etapa offline; opcional por ora
  tipo: z.nativeEnum(TipoInteracao),
  descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
  data: z.string().datetime().optional(),
  proximoPasso: z.string().trim().optional(),
  dataProximoPasso: z.string().datetime().or(z.string().date()).optional(),
});

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;
