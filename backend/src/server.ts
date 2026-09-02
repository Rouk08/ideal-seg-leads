import cron from 'node-cron';
import { createApp } from './app';
import { env } from './config/env';
import { releaseExpiredReservations } from './jobs/releaseExpiredReservations';

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ideal-seg-leads] backend rodando na porta ${env.PORT} (${env.NODE_ENV})`);
});

// Roda uma vez na subida (não espera até 03:00 pra corrigir reservas já
// vencidas) e depois diariamente.
void releaseExpiredReservations();
cron.schedule('0 3 * * *', () => {
  void releaseExpiredReservations();
});
