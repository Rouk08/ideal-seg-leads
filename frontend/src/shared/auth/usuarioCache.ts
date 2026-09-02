import type { Usuario } from '../types';

// Cache local só do PERFIL do usuário (nome/e-mail/perfil/metas) — nunca o
// access token, nunca nada sensível. Existe unicamente pra decidir "esse
// aparelho já teve uma sessão válida antes?" quando o /auth/refresh de
// bootstrap falha por estar OFFLINE (sem isso, abrir o app sem sinal chuta
// o vendedor pro login e ele não consegue nem cadastrar um cliente pra
// fila — quebra a regra de "funciona 100% sem rede").
const CHAVE = 'ideal-seg-leads:usuario-cache';

export function salvarUsuarioCache(usuario: Usuario): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(usuario));
  } catch {
    // localStorage indisponível (modo privado, cota etc.) — degrada
    // silenciosamente, só perde o fallback offline de bootstrap
  }
}

export function lerUsuarioCache(): Usuario | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  } catch {
    return null;
  }
}

export function limparUsuarioCache(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}
