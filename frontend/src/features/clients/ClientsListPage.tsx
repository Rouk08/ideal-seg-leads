import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type Cliente, type EtapaFunil } from '../../shared/types';
import { formatDateBR } from '../../shared/format';
import { TopBar } from '../../shared/components/TopBar';
import { BottomNav } from '../../shared/components/BottomNav';
import { SelectField } from '../../shared/components/SelectField';
import { SyncBanner } from '../../shared/components/SyncBanner';
import { useSyncQueue } from '../../offline/useSyncQueue';

interface ListaClientesResponse {
  items: Cliente[];
  total: number;
}

export function ClientsListPage() {
  const location = useLocation();
  const criadoOffline = Boolean((location.state as { criadoOffline?: boolean } | null)?.criadoOffline);

  const [busca, setBusca] = useState('');
  const [etapaFunil, setEtapaFunil] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { itens: fila } = useSyncQueue();

  const pendentes = fila.filter((i) => i.tipo === 'cliente');

  useEffect(() => {
    setCarregando(true);
    const timer = setTimeout(() => {
      api
        .get<ListaClientesResponse>('/clients', { busca: busca || undefined, etapaFunil: etapaFunil || undefined, pageSize: 100 })
        .then((res) => setClientes(res.items))
        .finally(() => setCarregando(false));
    }, 300); // debounce simples pra não disparar uma request a cada tecla

    return () => clearTimeout(timer);
  }, [busca, etapaFunil, pendentes.length]); // refaz a busca quando um item da fila termina de sincronizar

  return (
    <div className="app-shell">
      <TopBar title="Meus clientes" />
      <main className="app-main">
        {criadoOffline ? (
          <div className="alert alert-info">
            Sem conexão agora — o cadastro foi salvo no aparelho e vai ser enviado automaticamente assim que a
            internet voltar. Ele aparece abaixo como "Pendente de sincronização".
          </div>
        ) : null}
        <SyncBanner />

        <div className="field">
          <label htmlFor="busca">Buscar</label>
          <input
            id="busca"
            placeholder="Razão social, nome fantasia ou CNPJ/CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <SelectField
          label="Etapa do funil"
          placeholder="Todas as etapas"
          options={(Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[]).map((e) => ({ value: e, label: ETAPA_FUNIL_LABEL[e] }))}
          value={etapaFunil}
          onChange={(e) => setEtapaFunil(e.target.value)}
        />

        {pendentes.map((item) => (
          <div key={item.id} className="card" style={{ opacity: 0.75 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <strong>{(item.payload.nomeFantasia as string) || (item.payload.razaoSocial as string)}</strong>
                <div className="field-hint">{item.payload.cidade as string}</div>
              </div>
              <span className="badge">{item.ultimoErro ? '⚠️ Erro' : '⏳ Pendente'}</span>
            </div>
            <div className="field-hint" style={{ marginTop: 8 }}>
              {item.ultimoErro || 'Aguardando conexão para sincronizar…'}
            </div>
          </div>
        ))}

        {carregando ? (
          <p>Carregando…</p>
        ) : clientes.length === 0 && pendentes.length === 0 ? (
          <p className="field-hint">Nenhum cliente encontrado.</p>
        ) : (
          clientes.map((c) => (
            <Link key={c.id} to={`/clientes/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <strong>{c.nomeFantasia || c.razaoSocial}</strong>
                    <div className="field-hint">{c.cidade}</div>
                  </div>
                  <span className="badge">{ETAPA_FUNIL_LABEL[c.etapaFunil]}</span>
                </div>
                <div className="field-hint" style={{ marginTop: 8 }}>
                  Cadastrado em {formatDateBR(c.dataCadastro)}
                </div>
              </div>
            </Link>
          ))
        )}
      </main>
      <BottomNav />
    </div>
  );
}
