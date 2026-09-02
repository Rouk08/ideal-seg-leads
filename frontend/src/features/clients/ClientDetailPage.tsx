import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '../../shared/api/client';
import { isFalhaTransitoria } from '../../shared/api/isFalhaTransitoria';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  ETAPA_FUNIL_LABEL,
  SERVICOS_INTERESSE_LABEL,
  TIPO_INTERACAO_LABEL,
  type Cliente,
  type EtapaFunil,
  type Interacao,
  type TipoInteracao,
} from '../../shared/types';
import { formatCpfCnpj, formatCurrencyBRL, formatDateBR, formatDateTimeBR, formatPhone, whatsappLink } from '../../shared/format';
import { TopBar } from '../../shared/components/TopBar';
import { SelectField } from '../../shared/components/SelectField';
import { TextAreaField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
import { enqueueInteracao } from '../../offline/syncQueue';
import { useSyncQueue } from '../../offline/useSyncQueue';
import { ClientEditForm } from './ClientEditForm';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const criadoAgora = Boolean((location.state as { criado?: boolean } | null)?.criado);
  const { usuario } = useAuth();
  const souAdmin = usuario?.perfil === 'ADMIN';

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [salvandoEtapa, setSalvandoEtapa] = useState(false);
  const [editando, setEditando] = useState(false);
  const [encaminhando, setEncaminhando] = useState(false);
  const [erroEncaminhar, setErroEncaminhar] = useState('');
  const [orcamentoUrl, setOrcamentoUrl] = useState('');

  const [tipoInteracao, setTipoInteracao] = useState<TipoInteracao>('LIGACAO');
  const [descricaoInteracao, setDescricaoInteracao] = useState('');
  const [enviandoInteracao, setEnviandoInteracao] = useState(false);
  const [avisoOffline, setAvisoOffline] = useState('');

  const { itens: fila } = useSyncQueue();
  const interacoesPendentes = fila.filter((i) => i.tipo === 'interacao' && i.clienteId === id);

  async function carregar() {
    if (!id) return;
    setCarregando(true);
    try {
      const [c, listaInteracoes] = await Promise.all([
        api.get<Cliente>(`/clients/${id}`),
        api.get<{ items: Interacao[] }>(`/clients/${id}/interacoes`),
      ]);
      setCliente(c);
      setInteracoes(listaInteracoes.items);
    } catch (err) {
      // Ver detalhes de um cliente exige o servidor (não há cache offline de
      // leitura nesta etapa — só a fila de escrita); a mensagem pelo menos
      // deixa claro que é falta de conexão, não um erro de verdade.
      setErro(
        isFalhaTransitoria(err)
          ? 'Sem conexão — não é possível abrir os detalhes deste cliente agora. Tente novamente quando a internet voltar.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível carregar este cliente.',
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Quando uma interação pendente termina de sincronizar (a fila muda),
  // recarrega pra ela sair da lista "pendente" e entrar no histórico real.
  useEffect(() => {
    if (!carregando) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interacoesPendentes.length]);

  async function mudarEtapa(novaEtapa: EtapaFunil) {
    if (!id) return;
    setSalvandoEtapa(true);
    try {
      const atualizado = await api.patch<Cliente>(`/clients/${id}`, { etapaFunil: novaEtapa });
      setCliente(atualizado);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível mudar a etapa.');
    } finally {
      setSalvandoEtapa(false);
    }
  }

  async function encaminharParaOrcamento() {
    if (!id) return;
    setErroEncaminhar('');
    setEncaminhando(true);
    try {
      const res = await api.post<{ cliente: Cliente; orcamentoUrl: string }>(`/clients/${id}/encaminhar-orcamento`);
      setCliente(res.cliente);
      setOrcamentoUrl(res.orcamentoUrl);
      window.open(res.orcamentoUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setErroEncaminhar(err instanceof ApiError ? err.message : 'Não foi possível encaminhar este cliente para o ERP.');
    } finally {
      setEncaminhando(false);
    }
  }

  async function registrarInteracao(e: FormEvent) {
    e.preventDefault();
    if (!id || !descricaoInteracao.trim()) return;
    setEnviandoInteracao(true);
    setAvisoOffline('');
    // id gerado aqui, não no servidor — mesmo princípio do cadastro de
    // cliente: se a fila offline precisar reenviar depois, o reenvio com
    // este id é idempotente.
    const payload = { id: crypto.randomUUID(), tipo: tipoInteracao, descricao: descricaoInteracao };
    try {
      await api.post(`/clients/${id}/interacoes`, payload);
      setDescricaoInteracao('');
      await carregar(); // recarrega cliente (reservadoAte renovado) + histórico
    } catch (err) {
      if (isFalhaTransitoria(err)) {
        await enqueueInteracao(id, payload);
        setDescricaoInteracao('');
        setAvisoOffline('Sem conexão — a interação foi salva e será enviada assim que a internet voltar.');
      } else {
        setErro(err instanceof ApiError ? err.message : 'Não foi possível registrar a interação.');
      }
    } finally {
      setEnviandoInteracao(false);
    }
  }

  if (carregando) {
    return (
      <div className="app-shell">
        <TopBar title="Cliente" back />
        <main className="app-main">Carregando…</main>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="app-shell">
        <TopBar title="Cliente" back />
        <main className="app-main">
          <div className="alert alert-danger">{erro || 'Cliente não encontrado.'}</div>
        </main>
      </div>
    );
  }

  const numeroWhats = cliente.whatsapp || cliente.telefone;

  return (
    <div className="app-shell">
      <TopBar title={cliente.nomeFantasia || cliente.razaoSocial || 'Cliente'} back />
      <main className="app-main">
        {criadoAgora ? <div className="alert alert-success">Cliente cadastrado com sucesso!</div> : null}
        {erro ? <div className="alert alert-danger">{erro}</div> : null}

        <div className="card">
          <strong>{cliente.razaoSocial}</strong>
          {cliente.nomeFantasia ? <div className="field-hint">{cliente.nomeFantasia}</div> : null}
          <div style={{ marginTop: 8 }}>{formatCpfCnpj(cliente.cnpjCpf)}</div>
          <div className="field-hint">
            {[cliente.logradouro, cliente.numero, cliente.bairro, cliente.cidade, cliente.uf].filter(Boolean).join(', ')}
          </div>
        </div>

        {souAdmin && !editando ? (
          <Button type="button" variant="secondary" block style={{ marginBottom: 'var(--space-4)' }} onClick={() => setEditando(true)}>
            ✏️ Editar cadastro
          </Button>
        ) : null}

        {souAdmin && editando ? (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <ClientEditForm
              cliente={cliente}
              onCancelar={() => setEditando(false)}
              onSalvo={(atualizado) => {
                setCliente(atualizado);
                setEditando(false);
              }}
            />
          </div>
        ) : null}

        {souAdmin ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Orçamento e contrato</h3>
            <p className="field-hint">
              Encaminha este cliente para o ERP (idealseg.com), onde o orçamento e o contrato são montados.
            </p>
            {cliente.encaminhadoErpEm ? (
              <p>✅ Encaminhado em {formatDateTimeBR(cliente.encaminhadoErpEm)}.</p>
            ) : null}
            {erroEncaminhar ? <div className="alert alert-danger">{erroEncaminhar}</div> : null}
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button type="button" onClick={encaminharParaOrcamento} disabled={encaminhando}>
                {encaminhando ? 'Encaminhando…' : cliente.encaminhadoErpEm ? 'Reencaminhar (dados atualizados)' : 'Encaminhar para orçamento'}
              </Button>
              {cliente.encaminhadoErpEm ? (
                <a
                  href={orcamentoUrl || 'https://idealseg.com/admin/orcamentos'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" variant="secondary">
                    Abrir orçamentos no ERP ↗
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label>Etapa do funil</label>
          <SelectField
            label=""
            options={(Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[]).map((e) => ({ value: e, label: ETAPA_FUNIL_LABEL[e] }))}
            value={cliente.etapaFunil}
            disabled={salvandoEtapa}
            onChange={(e) => mudarEtapa(e.target.value as EtapaFunil)}
          />
        </div>

        {numeroWhats ? (
          <a href={whatsappLink(numeroWhats, `Olá ${cliente.nomeContato || ''}, tudo bem?`)} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" block style={{ marginBottom: 'var(--space-4)' }}>
              💬 Abrir WhatsApp
            </Button>
          </a>
        ) : null}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Contato</h3>
          <p>
            {cliente.nomeContato || '—'} {cliente.cargo ? `(${cliente.cargo})` : ''}
          </p>
          <p>Telefone: {cliente.telefone ? formatPhone(cliente.telefone) : '—'}</p>
          <p>E-mail: {cliente.email || '—'}</p>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Qualificação</h3>
          <p>{cliente.servicosInteresse.map((s) => SERVICOS_INTERESSE_LABEL[s]).join(', ') || '—'}</p>
          <p>Valor estimado: {formatCurrencyBRL(cliente.valorEstimadoMensal)}</p>
          <p>Cadastrado em: {formatDateBR(cliente.dataCadastro)}</p>
          {cliente.reservadoAte ? <p>Reserva de carteira até: {formatDateBR(cliente.reservadoAte)}</p> : null}
        </div>

        <h3>Histórico de interações</h3>
        {interacoesPendentes.map((item) => (
          <div key={item.id} className="card" style={{ opacity: 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="badge">{item.ultimoErro ? '⚠️ Erro' : '⏳ Pendente'}</span>
              <span className="field-hint">{TIPO_INTERACAO_LABEL[item.payload.tipo as TipoInteracao]}</span>
            </div>
            <p style={{ marginBottom: 0 }}>{item.payload.descricao as string}</p>
            <p className="field-hint" style={{ marginBottom: 0 }}>
              {item.ultimoErro || 'Aguardando conexão para sincronizar…'}
            </p>
          </div>
        ))}
        {interacoes.length === 0 && interacoesPendentes.length === 0 ? (
          <p className="field-hint">Nenhuma interação registrada ainda.</p>
        ) : (
          interacoes.map((i) => (
            <div key={i.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="badge">{TIPO_INTERACAO_LABEL[i.tipo]}</span>
                <span className="field-hint">{formatDateTimeBR(i.data)}</span>
              </div>
              <p style={{ marginBottom: 0 }}>{i.descricao}</p>
            </div>
          ))
        )}

        <h3>Nova interação</h3>
        {avisoOffline ? <div className="alert alert-info">{avisoOffline}</div> : null}
        <form onSubmit={registrarInteracao}>
          <SelectField
            label="Tipo"
            options={(Object.keys(TIPO_INTERACAO_LABEL) as TipoInteracao[]).map((t) => ({ value: t, label: TIPO_INTERACAO_LABEL[t] }))}
            value={tipoInteracao}
            onChange={(e) => setTipoInteracao(e.target.value as TipoInteracao)}
          />
          <TextAreaField
            label="Descrição"
            required
            value={descricaoInteracao}
            onChange={(e) => setDescricaoInteracao(e.target.value)}
          />
          <Button type="submit" block disabled={enviandoInteracao}>
            {enviandoInteracao ? 'Registrando…' : 'Registrar interação'}
          </Button>
        </form>
      </main>
    </div>
  );
}
