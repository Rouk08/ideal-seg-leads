import { getDB, type ItemFila, type TipoFila } from './db';
import { api } from '../shared/api/client';
import { isFalhaTransitoria } from '../shared/api/isFalhaTransitoria';

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

function calcularBackoff(tentativas: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** tentativas, BACKOFF_MAX_MS);
}

// Pub/sub minúsculo — os componentes (indicador de pendências, Home) se
// inscrevem aqui em vez de fazer polling no IndexedDB toda hora.
type Listener = () => void;
const listeners = new Set<Listener>();
function notificar() {
  listeners.forEach((l) => l());
}
export function onFilaMudou(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function enqueueCliente(payload: Record<string, unknown>, foto?: File | null): Promise<void> {
  const db = await getDB();
  const item: ItemFila = {
    id: payload.id as string,
    tipo: 'cliente',
    payload,
    fotoBlob: foto ?? undefined,
    fotoNome: foto?.name,
    criadoEm: Date.now(),
    tentativas: 0,
    proximaTentativaEm: Date.now(),
  };
  await db.put('filaSync', item);
  notificar();
  // De propósito NÃO dispara processQueue() aqui: quem chamou enqueue já
  // acabou de levar uma falha de rede agora mesmo, então tentar de novo na
  // mesma hora tem baixa chance de dar certo — o timer periódico (20s), o
  // evento 'online' e o botão "Tentar agora" é que fazem a próxima tentativa.
  // Isso também evita uma corrida entre chamador e sincronização automática.
}

export async function enqueueInteracao(clienteId: string, payload: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  const item: ItemFila = {
    id: payload.id as string,
    tipo: 'interacao',
    clienteId,
    payload,
    criadoEm: Date.now(),
    tentativas: 0,
    proximaTentativaEm: Date.now(),
  };
  await db.put('filaSync', item);
  notificar();
}

export async function listarFila(): Promise<ItemFila[]> {
  const db = await getDB();
  const items = await db.getAll('filaSync');
  return items.sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function contarPendentes(): Promise<number> {
  const db = await getDB();
  return db.count('filaSync');
}

async function enviarItem(item: ItemFila): Promise<void> {
  if (item.tipo === 'cliente') {
    const cliente = await api.post<{ id: string }>('/clients', item.payload);
    if (item.fotoBlob) {
      const formData = new FormData();
      formData.append('foto', item.fotoBlob, item.fotoNome || 'foto.jpg');
      try {
        await api.postForm(`/clients/${cliente.id}/foto`, formData);
      } catch {
        // cliente já sincronizou — a foto pode ser reenviada depois manualmente;
        // não vale a pena manter o cadastro inteiro preso na fila só por isso
      }
    }
  } else {
    await api.post(`/clients/${item.clienteId}/interacoes`, item.payload);
  }
}

let processando = false;

/**
 * Percorre a fila e tenta reenviar cada item cujo backoff já venceu.
 * Cada item usa seu próprio id (gerado no aparelho) como chave de
 * idempotência — o backend trata um reenvio do mesmo id como "já recebi
 * isso", nunca como duplicata. Erros de rede ficam retentando
 * silenciosamente; erros de validação/servidor ficam visíveis (ultimoErro)
 * mas o item NUNCA é descartado sozinho — perder o cadastro que o vendedor
 * digitou em campo não é uma opção.
 */
export async function processQueue(): Promise<void> {
  if (processando) return; // evita duas varreduras concorrentes (ex.: evento 'online' + timer)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  processando = true;
  try {
    const db = await getDB();
    const items = await db.getAll('filaSync');
    const agora = Date.now();

    for (const item of items) {
      if (item.proximaTentativaEm > agora) continue;

      try {
        await enviarItem(item);
        await db.delete('filaSync', item.id);
        notificar();
      } catch (err) {
        const tentativas = item.tentativas + 1;
        const mensagem = isFalhaTransitoria(err)
          ? 'Sem conexão com o servidor — vai tentar de novo automaticamente.'
          : err instanceof Error
            ? err.message
            : 'Erro ao sincronizar.';

        await db.put('filaSync', {
          ...item,
          tentativas,
          proximaTentativaEm: Date.now() + calcularBackoff(tentativas),
          ultimoErro: mensagem,
        });
        notificar();
      }
    }
  } finally {
    processando = false;
  }
}

let watcherIniciado = false;

/** Chamar uma vez, na raiz do app — liga os gatilhos automáticos de sincronização. */
export function iniciarSincronizacaoAutomatica(): void {
  if (watcherIniciado) return;
  watcherIniciado = true;

  window.addEventListener('online', () => void processQueue());
  // navigator.onLine nem sempre é confiável (ex.: Wi-Fi sem internet de
  // verdade) — um timer periódico cobre esse caso sem depender só do evento.
  setInterval(() => void processQueue(), 20_000);
  void processQueue();
}

export type { ItemFila, TipoFila };
