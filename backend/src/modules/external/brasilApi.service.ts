import { onlyDigits } from '../../lib/validators/cpfCnpj';

const TIMEOUT_MS = 5000;

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // BrasilAPI bloqueia (403) requisições sem User-Agent — o fetch nativo
    // do Node não manda um por padrão, diferente de curl/wget/navegador.
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ideal-seg-leads/1.0 (+https://idealseg.com.br)' },
    });
    if (!res.ok) return null; // 404 (CNPJ/CEP não encontrado) tratado como "sem dado", não como erro
    return await res.json();
  } catch {
    // Timeout, DNS, API fora do ar etc. — o cadastro nunca pode travar por
    // isso, então engolimos o erro aqui e devolvemos null pro chamador
    // decidir (o frontend cai pro preenchimento manual).
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface CnpjLookupResult {
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  porte: string;
  cnaePrincipal: string;
}

export async function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult | null> {
  const cnpj = onlyDigits(rawCnpj);
  if (cnpj.length !== 14) return null;

  const data = (await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)) as Record<string, unknown> | null;
  if (!data) return null;

  return {
    razaoSocial: String(data.razao_social ?? ''),
    nomeFantasia: String(data.nome_fantasia ?? ''),
    cep: String(data.cep ?? ''),
    logradouro: String(data.logradouro ?? ''),
    numero: String(data.numero ?? ''),
    bairro: String(data.bairro ?? ''),
    cidade: String(data.municipio ?? ''),
    uf: String(data.uf ?? ''),
    porte: String(data.descricao_porte ?? ''),
    cnaePrincipal: String(data.cnae_fiscal_descricao ?? ''),
  };
}

export interface CepLookupResult {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export async function lookupCep(rawCep: string): Promise<CepLookupResult | null> {
  const cep = onlyDigits(rawCep);
  if (cep.length !== 8) return null;

  const data = (await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`)) as Record<string, unknown> | null;
  if (!data) return null;

  return {
    cep: String(data.cep ?? cep),
    logradouro: String(data.street ?? ''),
    bairro: String(data.neighborhood ?? ''),
    cidade: String(data.city ?? ''),
    uf: String(data.state ?? ''),
  };
}
