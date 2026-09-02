// Node não tem IndexedDB — os testes do módulo offline rodam contra esse
// polyfill (mesma API do navegador) em vez de precisar de um browser real.
import 'fake-indexeddb/auto';

// jsdom/node não têm crypto.randomUUID em todas as versões; garante que
// existe (o código de produção usa o nativo do browser normalmente).
if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = await import('node:crypto');
  // @ts-expect-error - polyfill mínimo só pros testes
  globalThis.crypto = { ...globalThis.crypto, randomUUID };
}
