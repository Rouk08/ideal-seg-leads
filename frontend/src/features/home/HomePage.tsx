import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type Cliente, type EtapaFunil } from '../../shared/types';
import { formatCurrencyBRL } from '../../shared/format';
import { TopBar } from '../../shared/components/TopBar';
import { BottomNav } from '../../shared/components/BottomNav';
import { useSyncQueue } from '../../offline/useSyncQueue';

interface ListaClientesResponse {
  items: Cliente[];
  total: number;
}

export function HomePage() {
  const { usuario, sessaoDegradada } = useAuth();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const { itens: fila, pendentes } = useSyncQueue();
  const clientesPendentes = fila.filter((i) => i.tipo === 'cliente');

  useEffect(() => {
    // pageSize alto só pra agregação client-side nesta etapa; um endpoint de
    // estatísticas de verdade entra na etapa de dashboard. Refaz quando um
    // cadastro pendente termina de sincronizar (clientesPendentes.length cai).
    // Sem rede, cai pra lista vazia em vez de travar em "Carregando…" pra
    // sempre — o resto da tela (fila offline, + Novo cliente) continua útil.
    api
      .get<ListaClientesResponse>('/clients', { pageSize: 100 })
      .then((res) => setClientes(res.items))
      .catch(() => setClientes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientesPendentes.length]);

  const hoje = new Date();
  const cadastrosNoMesServidor = (clientes ?? []).filter((c) => {
    const d = new Date(c.dataCadastro);
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }).length;
  // cadastros ainda na fila também contam pro vendedor — ele já fez o
  // trabalho, só falta a conexão confirmar.
  const cadastrosNoMes = cadastrosNoMesServidor + clientesPendentes.length;

  const porEtapa = (clientes ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.etapaFunil] = (acc[c.etapaFunil] ?? 0) + 1;
    return acc;
  }, {});

  const etapasComContagem = (Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[]).filter((e) => porEtapa[e]);

  return (
    <div className="app-shell">
      <TopBar title={`Olá, ${usuario?.nome.split(' ')[0]}`} />
      <main className="app-main">
        {sessaoDegradada ? (
          <div className="alert alert-info">
            📴 Sem conexão no momento — mostrando os últimos dados salvos neste aparelho. Cadastros e interações
            continuam funcionando e serão enviados assim que a internet voltar.
          </div>
        ) : null}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{cadastrosNoMes}</div>
            <div className="label">Cadastros no mês</div>
          </div>
          <div className="stat-card">
            <div className="value">{usuario?.metaMensal ? formatCurrencyBRL(usuario.metaMensal) : '—'}</div>
            <div className="label">Meta do mês</div>
          </div>
        </div>

        <div className="card">
          <strong>Pendências de sincronização</strong>
          <p className="field-hint" style={{ margin: '4px 0 0' }}>
            {pendentes === 0
              ? 'Tudo sincronizado.'
              : `${pendentes} ${pendentes === 1 ? 'cadastro/interação' : 'cadastros/interações'} aguardando conexão para enviar.`}
          </p>
        </div>

        <h3>Leads por etapa</h3>
        {clientes === null ? (
          <p>Carregando…</p>
        ) : etapasComContagem.length === 0 ? (
          <p className="field-hint">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="card">
            {etapasComContagem.map((etapa) => (
              <div
                key={etapa}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}
              >
                <span>{ETAPA_FUNIL_LABEL[etapa]}</span>
                <strong>{porEtapa[etapa]}</strong>
              </div>
            ))}
          </div>
        )}

        <Link to="/clientes/novo">
          <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-4)' }}>
            + Novo cliente
          </button>
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
