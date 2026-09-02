import { beforeEach, describe, expect, it, vi } from 'vitest';

// api mockado — estes testes validam a LÓGICA da fila (enqueue, backoff,
// idempotência do lado do client), não uma chamada de rede de verdade
// (isso já é coberto pelos testes de integração do backend + pela
// verificação manual ponta a ponta).
const postMock = vi.fn();
const postFormMock = vi.fn();

class FakeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

vi.mock('../src/shared/api/client', () => ({
  api: {
    post: (...args: unknown[]) => postMock(...args),
    postForm: (...args: unknown[]) => postFormMock(...args),
  },
  ApiError: FakeApiError,
}));

const { _resetDBParaTestes } = await import('../src/offline/db');
const { enqueueCliente, enqueueInteracao, listarFila, contarPendentes, processQueue, onFilaMudou } = await import(
  '../src/offline/syncQueue'
);

function clientePayload(id: string, overrides: Record<string, unknown> = {}) {
  return { id, tipoPessoa: 'PJ', cnpjCpf: '11222333000181', razaoSocial: 'Empresa Teste', ...overrides };
}

beforeEach(async () => {
  await _resetDBParaTestes();
  postMock.mockReset();
  postFormMock.mockReset();
});

describe('fila offline — enqueue (não tenta enviar sozinho)', () => {
  it('guarda um cadastro de cliente na fila sem chamar a API', async () => {
    await enqueueCliente(clientePayload('c1'));

    expect(postMock).not.toHaveBeenCalled();
    expect(await contarPendentes()).toBe(1);
    const fila = await listarFila();
    expect(fila[0].tipo).toBe('cliente');
    expect(fila[0].id).toBe('c1');
  });

  it('guarda a foto (Blob) junto com o cadastro', async () => {
    const foto = new File(['conteudo'], 'fachada.jpg', { type: 'image/jpeg' });

    await enqueueCliente(clientePayload('c2'), foto);

    const [item] = await listarFila();
    expect(item.fotoBlob).toBeInstanceOf(Blob);
    expect(item.fotoNome).toBe('fachada.jpg');
  });

  it('guarda uma interação vinculada ao cliente certo', async () => {
    await enqueueInteracao('cliente-123', { id: 'i1', tipo: 'LIGACAO', descricao: 'teste' });

    const [item] = await listarFila();
    expect(item.tipo).toBe('interacao');
    expect(item.clienteId).toBe('cliente-123');
  });
});

describe('fila offline — sincronização', () => {
  it('remove o item da fila quando o envio dá certo', async () => {
    await enqueueCliente(clientePayload('c3'));
    expect(await contarPendentes()).toBe(1);

    postMock.mockResolvedValueOnce({ id: 'c3' });
    await processQueue();

    expect(await contarPendentes()).toBe(0);
  });

  it('nunca descarta o item sozinho quando o servidor recusa (erro de validação) — mantém visível com o erro', async () => {
    await enqueueCliente(clientePayload('c4'));
    postMock.mockRejectedValue(new FakeApiError(400, 'CNPJ inválido'));

    await processQueue();

    const [item] = await listarFila();
    expect(item.ultimoErro).toBe('CNPJ inválido');
    expect(item.tentativas).toBe(1);
    expect(await contarPendentes()).toBe(1); // continua na fila, visível — não some
  });

  it('erro 5xx (backend fora do ar / proxy sem alcançar o serviço) é tratado como transitório, não como erro de dado', async () => {
    // Achado testando offline de verdade: matar o backend faz o proxy (Vite
    // em dev, nginx em produção) responder 500/502/503/504 — uma resposta
    // HTTP de verdade, não uma falha de rede crua. Se isso fosse tratado
    // como "erro de dado", o vendedor veria uma mensagem confusa (o texto
    // de erro genérico do proxy) em vez de "aguardando conexão".
    await enqueueCliente(clientePayload('c10'));
    postMock.mockRejectedValue(new FakeApiError(500, 'Internal Server Error'));

    await processQueue();

    const [item] = await listarFila();
    expect(item.ultimoErro).toMatch(/conexão/i);
    expect(item.ultimoErro).not.toMatch(/Internal Server Error/);
  });

  it('reenviar não duplica: chamar processQueue de novo sobre uma fila já vazia não chama a API', async () => {
    await enqueueCliente(clientePayload('c5'));

    postMock.mockResolvedValueOnce({ id: 'c5' });
    await processQueue();
    expect(postMock).toHaveBeenCalledTimes(1);

    await processQueue(); // fila já vazia
    expect(postMock).toHaveBeenCalledTimes(1); // não chamou de novo
  });

  it('respeita o backoff: não tenta de novo antes da próxima janela', async () => {
    // Só o relógio é mockado (Date.now), não os timers — fake-indexeddb
    // depende de setTimeout/microtasks reais pra resolver suas transações
    // por baixo dos panos, então vi.useFakeTimers() trava os testes daqui
    // pra frente se usado junto (visto na prática antes desta correção).
    const agora = vi.spyOn(Date, 'now').mockReturnValue(0);

    await enqueueCliente(clientePayload('c6'));
    postMock.mockRejectedValue(new TypeError('Failed to fetch')); // simula falha de rede

    await processQueue(); // 1ª tentativa, agora (t=0)
    expect(postMock).toHaveBeenCalledTimes(1);

    await processQueue(); // ainda dentro da janela de backoff — não deve chamar de novo
    expect(postMock).toHaveBeenCalledTimes(1);

    agora.mockReturnValue(10_000); // passa da janela mínima (5s)
    await processQueue();
    expect(postMock).toHaveBeenCalledTimes(2);

    agora.mockRestore();
  });

  it('sobe a foto depois do cliente sincronizar, mas não derruba o item se só a foto falhar', async () => {
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    await enqueueCliente(clientePayload('c7'), foto);

    postMock.mockResolvedValueOnce({ id: 'c7' });
    postFormMock.mockRejectedValueOnce(new Error('falha ao subir a foto'));

    await processQueue();

    expect(postFormMock).toHaveBeenCalledOnce();
    expect(await contarPendentes()).toBe(0); // cliente já sincronizou, o item some da fila mesmo com a foto falhando
  });

  it('não chama a API duas vezes se processQueue for chamado em paralelo (guarda de concorrência)', async () => {
    await enqueueCliente(clientePayload('c9'));
    let resolvePost: (v: { id: string }) => void = () => {};
    postMock.mockReturnValueOnce(new Promise((resolve) => (resolvePost = resolve)));

    const primeira = processQueue();
    const segunda = processQueue(); // dispara enquanto a primeira ainda está "em voo"

    resolvePost({ id: 'c9' });
    await Promise.all([primeira, segunda]);

    expect(postMock).toHaveBeenCalledTimes(1);
  });
});

describe('fila offline — notificações', () => {
  it('avisa os inscritos quando a fila muda', async () => {
    const ouvinte = vi.fn();
    const cancelar = onFilaMudou(ouvinte);

    await enqueueCliente(clientePayload('c8'));
    expect(ouvinte).toHaveBeenCalled();

    cancelar();
  });
});
