import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Roda ANTES de qualquer arquivo de teste ser importado. Isso importa:
// src/config/env.ts lê process.env na hora do import, então precisamos
// garantir que a DATABASE_URL de teste já esteja setada nesse ponto —
// senão os testes rodariam (e fariam TRUNCATE) contra o banco de
// desenvolvimento/seed, como aconteceu uma vez neste projeto.
const envTestPath = path.resolve(__dirname, '../.env.test');

if (existsSync(envTestPath)) {
  config({ path: envTestPath, override: true });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[tests] backend/.env.test não encontrado — usando a DATABASE_URL do .env normal. ' +
      'Isso significa que os testes vão fazer TRUNCATE nas tabelas do banco de ' +
      'desenvolvimento! Copie backend/.env.test.example para backend/.env.test ' +
      'apontando pra um banco separado antes de rodar "npm test".',
  );
}
