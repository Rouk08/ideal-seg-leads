import { z } from 'zod';

// Valida as variáveis de ambiente uma única vez, na subida do processo.
// Se algo obrigatório faltar, o app falha rápido e com mensagem clara —
// em vez de quebrar de forma confusa em algum ponto aleatório depois.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET precisa ter pelo menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET precisa ter pelo menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(30),

  INVITE_EXPIRES_IN_HOURS: z.coerce.number().default(72),
  APP_URL: z.string().default('http://localhost:5173'), // usado para montar o link do convite

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10), // tentativas por janela
  RATE_LIMIT_LOGIN_WINDOW_MIN: z.coerce.number().default(15),

  UPLOADS_DIR: z.string().default('./uploads'),

  // Integração com o ERP (idealseg.com) — "encaminhar para orçamento".
  // Opcionais de propósito: sem eles configurados, a funcionalidade fica
  // indisponível com um erro claro em vez de derrubar o app inteiro na
  // subida (nem todo ambiente — dev, teste, PR de outra feature — precisa
  // ter essa integração configurada).
  ERP_API_URL: z.string().optional(), // ex.: https://idealseg.com/api
  ERP_APP_URL: z.string().optional(), // ex.: https://idealseg.com (usado pra montar o link que o admin abre)
  ERP_SERVICE_USERNAME: z.string().optional(),
  ERP_SERVICE_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
