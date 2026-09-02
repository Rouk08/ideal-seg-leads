import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Limita tentativas de login por IP — protege contra força bruta de senha.
// Não distingue e-mail existente/inexistente na resposta (evita enumeração
// de usuários), e o próprio 429 padrão do express-rate-limit já cobre isso.
export const loginRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MIN * 60 * 1000,
  max: env.RATE_LIMIT_LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});
