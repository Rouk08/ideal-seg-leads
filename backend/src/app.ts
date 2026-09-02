import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { invitesRouter } from './modules/invites/invites.routes';
import { clientsRouter } from './modules/clients/clients.routes';
import { externalRouter } from './modules/external/external.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // necessário atrás de proxy reverso (Caddy/Nginx) para req.ip funcionar

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true, // necessário para o cookie httpOnly do refresh token
    }),
  );
  app.use(express.json({ limit: '5mb' })); // limite folgado o bastante para payload de sync em lote
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/clients', clientsRouter);
  app.use('/api/external', externalRouter);

  // Demais módulos (interactions, sync, dashboard, export, settings) entram
  // aqui nas próximas etapas.

  app.use(errorHandler);

  return app;
}
