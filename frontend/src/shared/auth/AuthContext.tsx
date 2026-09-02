import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setAccessToken } from '../api/client';
import { isFalhaTransitoria } from '../api/isFalhaTransitoria';
import type { Usuario } from '../types';
import { lerUsuarioCache, limparUsuarioCache, salvarUsuarioCache } from './usuarioCache';

interface AuthState {
  usuario: Usuario | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  /** true quando a sessão veio do cache local (bootstrap falhou por estar
   * offline) — não existe access token nesse estado, então qualquer
   * chamada autenticada de verdade vai falhar até a conexão voltar. Serve
   * só pra permitir usar as telas (e a fila offline) sem rede. */
  sessaoDegradada: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [sessaoDegradada, setSessaoDegradada] = useState(false);

  // Na carga da página não existe access token em memória (de propósito —
  // nunca fica em storage persistente). O cookie httpOnly de refresh
  // sobrevive ao reload, então usamos /auth/refresh como bootstrap: ele já
  // devolve usuário + access token novo em uma chamada só.
  //
  // bootstrapIniciado evita uma segunda chamada real quando o efeito roda
  // duas vezes (React.StrictMode em dev) — /auth/refresh ROTACIONA o token
  // a cada uso, então a 2ª chamada usaria um cookie já revogado pela 1ª e
  // derrubaria a sessão que acabou de funcionar (bug real, visto em teste
  // manual). De propósito NÃO usamos o padrão de cleanup "cancelado = true":
  // o cleanup sintético do StrictMode roda entre a 1ª e a 2ª invocação, e
  // cancelaria o resultado da própria (única) requisição real antes dela
  // responder — ficando preso em "loading" pra sempre (outro bug real visto
  // ao corrigir o primeiro). Como o provider vive uma vez só pra vida toda
  // do app, não existe aqui o cenário de "componente desmontado de verdade
  // antes da resposta" que esse padrão normalmente evita.
  const bootstrapIniciado = useRef(false);
  useEffect(() => {
    if (bootstrapIniciado.current) return;
    bootstrapIniciado.current = true;

    api
      .post<{ usuario: Usuario; accessToken: string }>('/auth/refresh')
      .then((data) => {
        setAccessToken(data.accessToken);
        setUsuario(data.usuario);
        salvarUsuarioCache(data.usuario);
        setSessaoDegradada(false);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (!isFalhaTransitoria(err)) {
          // o servidor respondeu de verdade com um 4xx: sessão realmente
          // inválida/expirada (não é "sem rede" nem "backend fora do ar")
          // — aí sim precisa logar de novo.
          limparUsuarioCache();
          setStatus('unauthenticated');
          return;
        }

        // Falha transitória no bootstrap (sem rede, backend fora do ar,
        // proxy não alcançou o serviço — um 500/502/503/504 conta como
        // isso também, não só uma falha de rede crua). Regra de
        // negócio #6 exige que o app funcione sem conexão, então abrir a PWA
        // sem sinal não pode chutar quem já tinha sessão pro login. Usa o
        // último usuário conhecido em cache (sem token — qualquer chamada
        // de API de verdade vai falhar até a conexão voltar, mas o
        // cadastro/interação offline não depende disso, só de a requisição
        // falhar por rede, o que já acontece de qualquer forma).
        const cache = lerUsuarioCache();
        if (cache) {
          setUsuario(cache);
          setSessaoDegradada(true);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      });
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const data = await api.post<{ usuario: Usuario; accessToken: string }>('/auth/login', { email, senha });
    setAccessToken(data.accessToken);
    setUsuario(data.usuario);
    salvarUsuarioCache(data.usuario);
    setSessaoDegradada(false);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUsuario(null);
      limparUsuarioCache();
      setSessaoDegradada(false);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ usuario, status, sessaoDegradada, login, logout }),
    [usuario, status, sessaoDegradada, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
