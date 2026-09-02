import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type Cliente, type EtapaFunil } from '../../shared/types';
import { formatDateBR } from '../../shared/format';
import { TopBar } from '../../shared/components/TopBar';
import { BottomNav } from '../../shared/components/BottomNav';
import { SelectField } from '../../shared/components/SelectField';

interface ListaClientesResponse {
  items: Cliente[];
  total: number;
}

export function ClientsListPage() {
  const [busca, setBusca] = useState('');
  const [etapaFunil, setEtapaFunil] = useState('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const timer = setTimeout(() => {
      api
        .get<ListaClientesResponse>('/clients', { busca: busca || undefined, etapaFunil: etapaFunil || undefined, pageSize: 100 })
        .then((res) => setClientes(res.items))
        .finally(() => setCarregando(false));
    }, 300); // debounce simples pra não disparar uma request a cada tecla

    return () => clearTimeout(timer);
  }, [busca, etapaFunil]);

  return (
    <div className="app-shell">
      <TopBar title="Meus clientes" />
      <main className="app-main">
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

        {carregando ? (
          <p>Carregando…</p>
        ) : clientes.length === 0 ? (
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
