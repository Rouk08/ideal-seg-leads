import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import { INVITE_STATUS_LABEL, type Invite, type Perfil, type UsuarioAdmin } from '../../shared/types';
import { formatCurrencyBRL, formatDateBR } from '../../shared/format';
import { TextField } from '../../shared/components/TextField';
import { SelectField } from '../../shared/components/SelectField';
import { Button } from '../../shared/components/Button';

function EditableUserRow({ usuario, onSalvo }: { usuario: UsuarioAdmin; onSalvo: (u: UsuarioAdmin) => void }) {
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);
  const [metaMensal, setMetaMensal] = useState(usuario.metaMensal ?? '');
  const [percentualComissao, setPercentualComissao] = useState(usuario.percentualComissao ?? '');
  const [salvando, setSalvando] = useState(false);

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
      <td style={{ display: 'flex', gap: 6 }}>
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
      </td>
    </tr>
  );
}

export function UsersPage() {
  const { usuario: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [emailConvite, setEmailConvite] = useState('');
  const [nomeConvite, setNomeConvite] = useState('');
  const [perfilConvite, setPerfilConvite] = useState<'VENDEDOR' | 'SUPERVISOR'>('VENDEDOR');
  const [linkGerado, setLinkGerado] = useState('');
  const [erroConvite, setErroConvite] = useState('');
  const [enviandoConvite, setEnviandoConvite] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const [resUsuarios, resInvites] = await Promise.all([
        api.get<{ usuarios: UsuarioAdmin[] }>('/users'),
        eu?.perfil === 'ADMIN' ? api.get<{ invites: Invite[] }>('/invites') : Promise.resolve({ invites: [] }),
      ]);
      setUsuarios(resUsuarios.usuarios);
      setInvites(resInvites.invites);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function criarConvite(e: FormEvent) {
    e.preventDefault();
    setErroConvite('');
    setLinkGerado('');
    setEnviandoConvite(true);
    try {
      const res = await api.post<{ link: string }>('/invites', {
        email: emailConvite,
        nome: nomeConvite || undefined,
        perfil: perfilConvite,
      });
      setLinkGerado(res.link);
      setEmailConvite('');
      setNomeConvite('');
      await carregar();
    } catch (err) {
      setErroConvite(err instanceof ApiError ? err.message : 'Não foi possível gerar o convite.');
    } finally {
      setEnviandoConvite(false);
    }
  }

  async function revogarConvite(id: string) {
    await api.del(`/invites/${id}`);
    await carregar();
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
          <h2>Convites</h2>
          <form onSubmit={criarConvite} className="inline-form" style={{ marginBottom: 'var(--space-4)' }}>
            <TextField label="E-mail" type="email" required value={emailConvite} onChange={(e) => setEmailConvite(e.target.value)} />
            <TextField label="Nome (opcional)" value={nomeConvite} onChange={(e) => setNomeConvite(e.target.value)} />
            <SelectField
              label="Perfil"
              options={[
                { value: 'VENDEDOR', label: 'Vendedor' },
                { value: 'SUPERVISOR', label: 'Supervisor' },
              ]}
              value={perfilConvite}
              onChange={(e) => setPerfilConvite(e.target.value as 'VENDEDOR' | 'SUPERVISOR')}
            />
            <Button type="submit" disabled={enviandoConvite}>
              {enviandoConvite ? 'Gerando…' : 'Gerar convite'}
            </Button>
          </form>

          {erroConvite ? <div className="alert alert-danger">{erroConvite}</div> : null}
          {linkGerado ? (
            <div className="alert alert-success">
              Convite gerado! Envie este link ao vendedor:
              <br />
              <code style={{ wordBreak: 'break-all' }}>{linkGerado}</code>{' '}
              <Button type="button" variant="ghost" style={{ minHeight: 'auto', padding: '2px 8px' }} onClick={() => navigator.clipboard.writeText(linkGerado)}>
                Copiar
              </Button>
            </div>
          ) : null}

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Expira em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.email}</td>
                    <td>{i.perfil}</td>
                    <td>
                      <span className={`badge ${i.status === 'USADO' ? 'badge-success' : i.status === 'PENDENTE' ? '' : 'badge-danger'}`}>
                        {INVITE_STATUS_LABEL[i.status]}
                      </span>
                    </td>
                    <td>{formatDateBR(i.expiresAt)}</td>
                    <td>
                      {i.status === 'PENDENTE' ? (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => revogarConvite(i.id)}
                          style={{ minHeight: 32, padding: '2px 10px' }}
                        >
                          Revogar
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="field-hint">
                      Nenhum convite gerado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
