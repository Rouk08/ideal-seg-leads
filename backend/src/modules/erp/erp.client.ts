import { env } from '../../config/env';
import { HttpError } from '../../middlewares/errorHandler';

// Cliente HTTP fino pro ERP (idealseg.com) — usado só pra "encaminhar" um
// lead qualificado pra lá, onde o orçamento e o contrato de fato são
// gerados (fluxo já maduro no ERP: Orçamentos → Contratos com assinatura).
// Este CRM não duplica essa parte; só entrega o cliente pronto lá.
//
// Autentica como uma conta de serviço dedicada (ERP_SERVICE_USERNAME/
// ERP_SERVICE_PASSWORD — um usuário "operator" no ERP com permissão só de
// "clientes" e "orcamentos", sem acesso a financeiro/RH). Token é JWT de
// 12h no ERP; cacheamos em memória e renovamos um pouco antes de expirar.

interface ErpAuthState {
  token: string;
  expiresAt: number; // epoch ms
}

let cached: ErpAuthState | null = null;

function requireConfig() {
  if (!env.ERP_API_URL || !env.ERP_SERVICE_USERNAME || !env.ERP_SERVICE_PASSWORD) {
    throw new HttpError(503, 'Integração com o ERP não está configurada neste ambiente.');
  }
  return {
    apiUrl: env.ERP_API_URL.replace(/\/+$/, ''),
    username: env.ERP_SERVICE_USERNAME,
    password: env.ERP_SERVICE_PASSWORD,
  };
}

async function login(): Promise<string> {
  const { apiUrl, username, password } = requireConfig();

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new HttpError(502, 'Não foi possível conectar ao ERP agora. Tente novamente em instantes.');
  }

  if (!res.ok) {
    throw new HttpError(502, 'Não foi possível autenticar no ERP (credenciais de integração inválidas?).');
  }

  const data = (await res.json()) as { access_token: string };
  // token real dura 12h no ERP (ver backend/auth.py); guardamos por 11h pra
  // nunca correr o risco de usar um token que expira no meio de uma chamada
  cached = { token: data.access_token, expiresAt: Date.now() + 11 * 60 * 60 * 1000 };
  return cached.token;
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  return login();
}

async function erpFetch(path: string, init: RequestInit, isRetry = false): Promise<Response> {
  const { apiUrl } = requireConfig();
  const token = await getToken();

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new HttpError(502, 'Não foi possível conectar ao ERP agora. Tente novamente em instantes.');
  }

  // Token pode ter sido revogado/expirado entre chamadas — tenta autenticar
  // de novo UMA vez antes de desistir (mesmo espírito do refresh do próprio
  // front deste CRM).
  if (res.status === 401 && !isRetry) {
    cached = null;
    return erpFetch(path, init, true);
  }

  return res;
}

export interface ErpClientePayload {
  name: string;
  fantasy_name?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

/**
 * Cria (POST) ou atualiza (PUT) o cliente no ERP. Passar um erpClienteId já
 * existente reaproveita o mesmo registro lá — reencaminhar nunca cria uma
 * segunda cópia. Se o registro tiver sido apagado no ERP nesse meio-tempo
 * (404), cai pra criação de um novo.
 */
export async function upsertCliente(erpClienteId: string | null, payload: ErpClientePayload): Promise<{ id: string }> {
  const path = erpClienteId ? `/admin/clients/${erpClienteId}` : '/admin/clients';
  const method = erpClienteId ? 'PUT' : 'POST';

  const res = await erpFetch(path, { method, body: JSON.stringify(payload) });

  if (res.status === 404 && erpClienteId) {
    return upsertCliente(null, payload);
  }
  if (!res.ok) {
    throw new HttpError(502, 'Não foi possível encaminhar este cliente para o ERP.');
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

/** URL que o admin abre pra montar o orçamento (e, depois, o contrato) no ERP. */
export function montarUrlOrcamento(): string {
  const base = (env.ERP_APP_URL ?? 'https://idealseg.com').replace(/\/+$/, '');
  return `${base}/admin/orcamentos`;
}

// Exportado só pra os testes poderem resetar o cache do token entre casos.
export function _resetCacheParaTeste(): void {
  cached = null;
}
