import { useEffect, useState } from 'react';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type DashboardStats, type EtapaFunil } from '../../shared/types';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>('/dashboard/stats').then(setStats);
  }, []);

  if (!stats) return <p>Carregando…</p>;

  const etapas = Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[];

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="value">{stats.totalClientes}</div>
          <div className="label">Total de clientes</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.cadastrosNoMes}</div>
          <div className="label">Cadastros no mês</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.taxaConversaoGeral !== null ? `${stats.taxaConversaoGeral}%` : '—'}</div>
          <div className="label">Taxa de conversão</div>
        </div>
        <div className="stat-card">
          <div className="value">{stats.porVendedor.length}</div>
          <div className="label">Vendedores</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        <div>
          <h3>Funil consolidado</h3>
          <div className="card">
            {etapas
              .filter((e) => stats.porEtapa[e])
              .map((e) => (
                <div
                  key={e}
                  style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}
                >
                  <span>{ETAPA_FUNIL_LABEL[e]}</span>
                  <strong>{stats.porEtapa[e]}</strong>
                </div>
              ))}
            {etapas.every((e) => !stats.porEtapa[e]) ? <p className="field-hint">Nenhum cliente cadastrado ainda.</p> : null}
          </div>
        </div>

        <div>
          <h3>Ranking de vendedores</h3>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Cadastros</th>
                  <th>Ganhos</th>
                  <th>Perdidos</th>
                  <th>Conversão</th>
                </tr>
              </thead>
              <tbody>
                {stats.ranking.map((v) => (
                  <tr key={v.vendedorId}>
                    <td>
                      {v.vendedorNome}
                      {!v.ativo ? <span className="field-hint"> (inativo)</span> : null}
                    </td>
                    <td>{v.total}</td>
                    <td>{v.ganho}</td>
                    <td>{v.perdido}</td>
                    <td>{v.taxaConversao !== null ? `${v.taxaConversao}%` : '—'}</td>
                  </tr>
                ))}
                {stats.ranking.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="field-hint">
                      Nenhum vendedor cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
