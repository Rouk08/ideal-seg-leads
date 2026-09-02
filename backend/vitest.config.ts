import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/env.setup.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Os testes fazem TRUNCATE no banco a cada `beforeEach` — com mais de um
    // arquivo de teste, rodar em paralelo faz um arquivo truncar a tabela
    // enquanto outro está no meio de um teste (deadlock/FK violation
    // aleatórios). Roda os arquivos em sequência; ainda rápido nesta escala.
    fileParallelism: false,
  },
});
