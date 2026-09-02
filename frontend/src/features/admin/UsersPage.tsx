import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import type { Perfil, UsuarioAdmin } from '../../shared/types';
import { formatCurrencyBRL } from '../../shared/format';
import { TextField } from '../../shared/components/TextField';
import { SelectField } from '../../shared/components/SelectField';
import { Button } from '../../shared/components/Button';

function ResetPasswordForm({ usuarioId, onFeito }: { usuarioId: string; onFeito: () => void }) {
  const [senha, setSenha] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api.post(`/users/${usuarioId}/redefinir-senha`, { senha });
      setSenha('');
      onFeito();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} style={{ display: 'flex', gap: 6, alignItems: 'start' }}>
      <div>
        <input
          type="password"
          required
          minLength={8}
          placeholder="Nova senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={{ minHeight: 32, padding: '2px 6px', width: 140 }}
        />
        {erro ? <div className="field-error">{erro}</div> : null}
      </div>
      <Button type="submit" disabled={salvando} style={{ minHeight: 32, padding: '2px 10px' }}>
        {salvando ? 'Salvando…' : 'Confirmar'}
      </Button>
    </form>
  );
}

function EditableUserRow({ usuario, onSalvo }: { usuario: UsuarioAdmin; onSalvo: (u: UsuarioAdmin) => void }) {
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);
  const [metaMensal, setMetaMensal] = useState(usuario.metaMensal ?? '');
  const [percentualComissao, setPercentualComissao] = useState(usuario.percentualComissao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [redefinindo, setRedefinindo] = useState(false);

  const alterado =
    perfil !== usuario.perfil ||
    String(metaMensal) !== String(usuario.metaMensal ?? '') ||
    String(percentualComissao) !== String(usuario.percentualComissao ?? '');

  async function salvar() {
    setSalvando(true);
    try {
      const atualizado = await api.patch<UsuarioAdmin>(`/users/${usuario.id}`, {
        perfil,
        metaMensal: metaMensal === '' ? null : Number(metaMensal),
        percentualComissao: percentualComissao === '' ? null : Number(percentualComissao),
      });
      onSalvo(atualizado);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    setSalvando(true);
    try {
      const atualizado = await api.patch<UsuarioAdmin>(`/users/${usuario.id}`, { ativo: !usuario.ativo });
      onSalvo(atualizado);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <tr>
        <td>{usuario.nome}</td>
        <td>{usuario.email}</td>
        <td>
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)} style={{ minHeight: 32, padding: '2px 6px' }}>
            <option value="VENDEDOR">Vendedor</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </select>
        </td>
        <td>
          <input
            type="number"
            min={0}
            step="0.01"
            value={metaMensal}
            onChange={(e) => setMetaMensal(e.target.value)}
            style={{ width: 100, minHeight: 32, padding: '2px 6px' }}
          />
        </td>
        <td>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={percentualComissao}
            onChange={(e) => setPercentualComissao(e.target.value)}
            style={{ width: 70, minHeight: 32, padding: '2px 6px' }}
          />
          %
        </td>
        <td>
          <span className={`badge ${usuario.ativo ? 'badge-success' : 'badge-danger'}`}>{usuario.ativo ? 'Ativo' : 'Inativo'}</span>
        </td>
        <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button type="button" onClick={salvar} disabled={!alterado || salvando} style={{ minHeight: 32, padding: '2px 10px' }}>
            Salvar
          </Button>
          <Button
            type="button"
            variant={usuario.ativo ? 'danger' : 'secondary'}
            onClick={alternarAtivo}
            disabled={salvando}
            style={{ minHeight: 32, padding: '2px 10px' }}
          >
            {usuario.ativo ? 'Desativar' : 'Ativar'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRedefinindo((v) => !v)}
            style={{ minHeight: 32, padding: '2px 10px' }}
          >
            {redefinindo ? 'Cancelar' : 'Redefinir senha'}
          </Button>
        </td>
      </tr>
      {redefinindo ? (
        <tr>
          <td colSpan={7} style={{ background: 'var(--color-primary-light)' }}>
            <ResetPasswordForm usuarioId={usuario.id} onFeito={() => setRedefinindo(false)} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function UsersPage() {
  const { usuario: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [nomeNovo, setNomeNovo] = useState('');
  const [emailNovo, setEmailNovo] = useState('');
  const [senhaNovo, setSenhaNovo] = useState('');
  const [perfilNovo, setPerfilNovo] = useState<'VENDEDOR' | 'SUPERVISOR'>('VENDEDOR');
  const [erroNovo, setErroNovo] = useState('');
  const [sucessoNovo, setSucessoNovo] = useState('');
  const [criandoNovo, setCriandoNovo] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await api.get<{ usuarios: UsuarioAdmin[] }>('/users');
      setUsuarios(res.usuarios);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function criarUsuario(e: FormEvent) {
    e.preventDefault();
    setErroNovo('');
    setSucessoNovo('');
    setCriandoNovo(true);
    try {
      const criado = await api.post<UsuarioAdmin>('/users', {
        nome: nomeNovo,
        email: emailNovo,
        senha: senhaNovo,
        perfil: perfilNovo,
      });
      setSucessoNovo(`Colaborador ${criado.nome} criado. Repasse o usuário (${criado.email}) e a senha a ele.`);
      setNomeNovo('');
      setEmailNovo('');
      setSenhaNovo('');
      await carregar();
    } catch (err) {
      setErroNovo(err instanceof ApiError ? err.message : 'Não foi possível criar o colaborador.');
    } finally {
      setCriandoNovo(false);
    }
  }

  const souAdmin = eu?.perfil === 'ADMIN';

  return (
    <div>
      <h2>Usuários</h2>

      {carregando ? (
        <p>Carregando…</p>
      ) : (
        <div className="data-table-wrap" style={{ marginBottom: 'var(--space-6)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Meta mensal</th>
                <th>Comissão</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {souAdmin
                ? usuarios.map((u) => (
                    <EditableUserRow
                      key={u.id}
                      usuario={u}
                      onSalvo={(atualizado) => setUsuarios((lista) => lista.map((x) => (x.id === atualizado.id ? atualizado : x)))}
                    />
                  ))
                : usuarios.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nome}</td>
                      <td>{u.email}</td>
                      <td>{u.perfil}</td>
                      <td>{formatCurrencyBRL(u.metaMensal)}</td>
                      <td>{u.percentualComissao ? `${u.percentualComissao}%` : '—'}</td>
                      <td>
                        <span className={`badge ${u.ativo ? 'badge-success' : 'badge-danger'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                      </td>
                      <td />
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {souAdmin ? (
        <>
          <h2>Novo colaborador</h2>
          <p className="field-hint" style={{ marginTop: -8, marginBottom: 'var(--space-3)' }}>
            Defina um usuário (e-mail) e uma senha para o colaborador acessar direto — sem convite.
          </p>
          <form onSubmit={criarUsuario} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
            <TextField label="Nome" required value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
            <TextField label="E-mail (usuário)" type="email" required value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} />
            <TextField
              label="Senha"
              type="password"
              required
              minLength={8}
              hint="mín. 8 caracteres"
              value={senhaNovo}
              onChange={(e) => setSenhaNovo(e.target.value)}
            />
            <SelectField
              label="Perfil"
              options={[
                { value: 'VENDEDOR', label: 'Vendedor' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
              ]}
              value={perfilNovo}
              onChange={(e) => setPerfilNovo(e.target.value as 'VENDEDOR' | 'SUPERVISOR')}
            />
            <Button type="submit" disabled={criandoNovo}>
              {criandoNovo ? 'Criando…' : 'Criar colaborador'}
            </Button>
          </form>

          {erroNovo ? <div className="alert alert-danger">{erroNovo}</div> : null}
          {sucessoNovo ? <div className="alert alert-success">{sucessoNovo}</div> : null}
        </>
      ) : null}
    </div>
  );
}
