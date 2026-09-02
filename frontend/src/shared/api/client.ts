// Cliente HTTP fino sobre fetch. Decisões importantes:
// - access token fica só em memória (nunca localStorage/sessionStorage) —
//   um XSS não consegue roubar um token que não está em nenhum storage
//   acessível por JS além desta variável de módulo.
// - refresh token é um cookie httpOnly, o browser manda sozinho
//   (credentials: 'include'); este client nunca vê o valor dele.
// - em qualquer 401 (exceto no próprio /auth/login e /auth/refresh), tenta
//   renovar a sessão UMA vez via /auth/refresh e repete a requisição
//   original; se o refresh também falhar, a sessão realmente expirou.

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada');
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  isFormData?: boolean;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!options.isFormData && options.body !== undefined) headers['Content-Type'] = 'application/json';

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.isFormData ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const res = await doFetch(path, options);

  if (res.status === 401 && !isRetry && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, true);
    setAccessToken(null);
    throw new SessionExpiredError();
  }

  const body = await parseBody(res);

  if (!res.ok) {
    const message = (body as { error?: string } | undefined)?.error ?? `Erro ${res.status}`;
    throw new ApiError(res.status, message, (body as { details?: unknown } | undefined)?.details);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData, isFormData: true }),
};
