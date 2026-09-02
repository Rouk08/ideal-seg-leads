import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Uma fila só, com um campo "tipo" pra discriminar — cadastro de cliente
// e nova interação seguem exatamente o mesmo ciclo de vida (tenta online
// primeiro, guarda aqui só se falhar por rede, tenta de novo com backoff).
export type TipoFila = 'cliente' | 'interacao';

export interface ItemFila {
  id: string; // = o id do Cliente/Interacao (gerado no aparelho) — é a chave de idempotência
  tipo: TipoFila;
  clienteId?: string; // só pra tipo 'interacao': em qual cliente ela entra
  payload: Record<string, unknown>;
  fotoBlob?: Blob; // só pra tipo 'cliente', foto da fachada já comprimida
  fotoNome?: string;
  criadoEm: number;
  tentativas: number;
  proximaTentativaEm: number;
  ultimoErro?: string;
}

interface IdealSegDB extends DBSchema {
  filaSync: {
    key: string;
    value: ItemFila;
  };
}

let dbPromise: Promise<IDBPDatabase<IdealSegDB>> | null = null;

const DB_NAME = 'ideal-seg-leads';

export function getDB(): Promise<IDBPDatabase<IdealSegDB>> {
  if (!dbPromise) {
    dbPromise = openDB<IdealSegDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('filaSync', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

/** Só pra isolar os testes uns dos outros — nunca chamado em produção. */
export async function _resetDBParaTestes(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
