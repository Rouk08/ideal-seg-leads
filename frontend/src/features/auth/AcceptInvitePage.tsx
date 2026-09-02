import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, ApiError } from '../../shared/api/client';
import { TextField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';

interface InviteInfo {
  email: string;
  nome?: string | null;
  perfil: string;
}

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [erroValidacao, setErroValidacao] = useState('');
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!token) {
      setErroValidacao('Link de convite inválido — falta o token.');
      setCarregando(false);
      return;
    }
    api
      .get<InviteInfo>('/invites/validate', { token })
      .then((data) => {
        setInvite(data);
        setNome(data.nome ?? '');
      })
      .catch((err) => setErroValidacao(err instanceof ApiError ? err.message : 'Convite inválido.'))
      .finally(() => setCarregando(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErroForm('');

    if (senha !== confirmarSenha) {
      setErroForm('As senhas não conferem.');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/invites/accept', { token, nome, senha, confirmarSenha });
      setSucesso(true);
    } catch (err) {
      setErroForm(err instanceof ApiError ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <div className="app-main">Verificando convite…</div>;
  }

  if (sucesso) {
    return (
      <div className="app-main" style={{ paddingTop: '15vh', textAlign: 'center' }}>
        <div className="alert alert-success">Conta criada! Você já pode entrar.</div>
        <Button onClick={() => navigate('/login')} block>
          Ir para o login
        </Button>
      </div>
    );
  }

  if (erroValidacao) {
    return (
      <div className="app-main" style={{ paddingTop: '15vh', textAlign: 'center' }}>
        <div className="alert alert-danger">{erroValidacao}</div>
        <Link to="/login">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <div className="app-main" style={{ paddingTop: '10vh' }}>
      <h2>Bem-vindo(a) à Ideal Seg</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Convite para <strong>{invite?.email}</strong>. Defina seu nome e uma senha para concluir o cadastro.
      </p>

      <form onSubmit={onSubmit}>
        {erroForm ? <div className="alert alert-danger">{erroForm}</div> : null}
        <TextField label="Nome completo" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <TextField
          label="Senha"
          type="password"
          required
          minLength={8}
          hint="Pelo menos 8 caracteres"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <TextField
          label="Confirmar senha"
          type="password"
          required
          minLength={8}
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
        />
        <Button type="submit" block disabled={enviando}>
          {enviando ? 'Concluindo…' : 'Concluir cadastro'}
        </Button>
      </form>
    </div>
  );
}
