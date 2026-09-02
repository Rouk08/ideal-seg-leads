import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ideal-seg-leads] backend rodando na porta ${env.PORT} (${env.NODE_ENV})`);
});
