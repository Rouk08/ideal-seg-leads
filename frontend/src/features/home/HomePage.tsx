import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type Cliente, type EtapaFunil } from '../../shared/types';
import { formatCurrencyBRL } from '../../shared/format';
import { TopBar } from '../../shared/components/TopBar';
import { BottomNav } from '../../shared/components/BottomNav';

interface ListaClientesResponse {
  items: Cliente[];
  total: number;
}

export function HomePage() {
  const { usuario } = useAuth();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);

  useEffect(() => {
    // pageSize alto só pra agregação client-side nesta etapa; um endpoint de
    // estatísticas de verdade entra na etapa de dashboard.
    api.get<ListaClientesResponse>('/clients', { pageSize: 100 }).then((res) => setClientes(res.items));
  }, []);

  const hoje = new Date();
  const cadastrosNoMes = (clientes ?? []).filter((c) => {
    const d = new Date(c.dataCadastro);
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }).length;

  const porEtapa = (clientes ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.etapaFunil] = (acc[c.etapaFunil] ?? 0) + 1;
    return acc;
  }, {});

  const etapasComContagem = (Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[]).filter((e) => porEtapa[e]);

  return (
    <div className="app-shell">
      <TopBar title={`Olá, ${usuario?.nome.split(' ')[0]}`} />
      <main className="app-main">
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
            0 — a fila offline entra na próxima etapa. Por enquanto o app funciona só online.
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
