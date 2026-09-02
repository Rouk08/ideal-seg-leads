import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Perfil } from '../types';

/** Envolve rotas que exigem sessão — e opcionalmente um conjunto de perfis. */
export function RequireAuth({ children, perfis }: { children: ReactNode; perfis?: Perfil[] }) {
  const { status, usuario } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="app-main">Carregando…</div>;
  }

  if (status === 'unauthenticated' || !usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (perfis && !perfis.includes(usuario.perfil)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
