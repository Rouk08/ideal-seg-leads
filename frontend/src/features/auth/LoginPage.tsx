import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { ApiError } from '../../shared/api/client';

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app-main" style={{ paddingTop: '15vh' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            margin: '0 auto var(--space-3)',
          }}
        >
          IS
        </div>
        <h2 style={{ margin: 0 }}>Ideal Seg</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Captação de leads</p>
      </div>

      <form onSubmit={onSubmit}>
        {erro ? <div className="alert alert-danger">{erro}</div> : null}
        <TextField
          label="E-mail"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Button type="submit" block disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
