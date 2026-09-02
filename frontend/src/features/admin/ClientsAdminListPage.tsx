import { useEffect, useState } from 'react';
import { api } from '../../shared/api/client';
import { ETAPA_FUNIL_LABEL, type Cliente, type EtapaFunil, type UsuarioAdmin } from '../../shared/types';
import { formatDateBR } from '../../shared/format';
import { SelectField } from '../../shared/components/SelectField';
import { Button } from '../../shared/components/Button';

interface ListaClientesResponse {
  items: Cliente[];
  total: number;
}

interface Filtros {
  vendedorId: string;
  etapaFunil: string;
  cidade: string;
  busca: string;
  dataInicio: string;
  dataFim: string;
}

const FILTROS_VAZIOS: Filtros = { vendedorId: '', etapaFunil: '', cidade: '', busca: '', dataInicio: '', dataFim: '' };

export function ClientsAdminListPage() {
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [vendedores, setVendedores] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [reatribuindoId, setReatribuindoId] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    api.get<{ usuarios: UsuarioAdmin[] }>('/users', { perfil: 'VENDEDOR' }).then((res) => setVendedores(res.usuarios));
  }, []);

  useEffect(() => {
    setCarregando(true);
    const timer = setTimeout(() => {
      api
        .get<ListaClientesResponse>('/clients', {
          vendedorId: filtros.vendedorId || undefined,
          etapaFunil: filtros.etapaFunil || undefined,
          cidade: filtros.cidade || undefined,
          busca: filtros.busca || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
          pageSize: 100,
        })
        .then((res) => {
          setClientes(res.items);
          setTotal(res.total);
        })
        .finally(() => setCarregando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [filtros]);

  function atualizarFiltro<K extends keyof Filtros>(campo: K, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  async function reatribuir(clienteId: string, novoVendedorId: string) {
    if (!novoVendedorId) return;
    setReatribuindoId(clienteId);
    try {
      const atualizado = await api.patch<Cliente>(`/clients/${clienteId}/reassign`, { vendedorId: novoVendedorId });
      setClientes((lista) => lista.map((c) => (c.id === clienteId ? atualizado : c)));
    } finally {
      setReatribuindoId(null);
    }
  }

  async function exportarCsv() {
    setExportando(true);
    try {
      // precisa ser um fetch autenticado (Bearer token) — um <a href> puro
      // não manda o header e cairia em 401. api.download já cuida disso
      // (e do retry-on-401 via refresh, igual o resto do client).
      const { blob, filename } = await api.download(
        '/clients/export',
        {
          vendedorId: filtros.vendedorId || undefined,
          etapaFunil: filtros.etapaFunil || undefined,
          cidade: filtros.cidade || undefined,
          busca: filtros.busca || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
        },
        'clientes.csv',
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Clientes</h2>
        <Button type="button" variant="secondary" onClick={exportarCsv} disabled={exportando}>
          {exportando ? 'Exportando…' : '⬇️ Exportar CSV'}
        </Button>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label>Buscar</label>
          <input placeholder="Razão social, fantasia ou CNPJ/CPF" value={filtros.busca} onChange={(e) => atualizarFiltro('busca', e.target.value)} />
        </div>
        <SelectField
          label="Vendedor"
          placeholder="Todos"
          options={vendedores.map((v) => ({ value: v.id, label: v.nome }))}
          value={filtros.vendedorId}
          onChange={(e) => atualizarFiltro('vendedorId', e.target.value)}
        />
        <SelectField
          label="Etapa"
          placeholder="Todas"
          options={(Object.keys(ETAPA_FUNIL_LABEL) as EtapaFunil[]).map((e) => ({ value: e, label: ETAPA_FUNIL_LABEL[e] }))}
          value={filtros.etapaFunil}
          onChange={(e) => atualizarFiltro('etapaFunil', e.target.value)}
        />
        <div className="field">
          <label>Cidade</label>
          <input value={filtros.cidade} onChange={(e) => atualizarFiltro('cidade', e.target.value)} />
        </div>
        <div className="field">
          <label>De</label>
          <input type="date" value={filtros.dataInicio} onChange={(e) => atualizarFiltro('dataInicio', e.target.value)} />
        </div>
        <div className="field">
          <label>Até</label>
          <input type="date" value={filtros.dataFim} onChange={(e) => atualizarFiltro('dataFim', e.target.value)} />
        </div>
        <Button type="button" variant="ghost" onClick={() => setFiltros(FILTROS_VAZIOS)}>
          Limpar filtros
        </Button>
      </div>

      <p className="field-hint">{total} cliente(s) encontrado(s)</p>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Cidade</th>
              <th>Etapa</th>
              <th>Vendedor</th>
              <th>Cadastro</th>
              <th>Reatribuir para</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6}>Carregando…</td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="field-hint">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.nomeFantasia || c.razaoSocial}</td>
                  <td>{c.cidade}</td>
                  <td>
                    <span className="badge">{ETAPA_FUNIL_LABEL[c.etapaFunil]}</span>
                  </td>
                  <td>{c.vendedor?.nome}</td>
                  <td>{formatDateBR(c.dataCadastro)}</td>
                  <td>
                    <select
                      value=""
                      disabled={reatribuindoId === c.id}
                      onChange={(e) => reatribuir(c.id, e.target.value)}
                      style={{ minHeight: 32, padding: '2px 6px' }}
                    >
                      <option value="">Selecione…</option>
                      {vendedores
                        .filter((v) => v.id !== c.vendedorId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.nome}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
