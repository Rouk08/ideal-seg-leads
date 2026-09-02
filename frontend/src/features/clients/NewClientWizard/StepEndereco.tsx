import { useState } from 'react';
import { TextField } from '../../../shared/components/TextField';
import { Button } from '../../../shared/components/Button';
import { formatCep, onlyDigits } from '../../../shared/format';
import { api, ApiError } from '../../../shared/api/client';
import type { ClienteFormData } from './draft';

interface CepLookupResult {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface Props {
  form: ClienteFormData;
  update: <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
}

export function StepEndereco({ form, update }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cepDigitos = onlyDigits(form.cep);
  const cepCompleto = cepDigitos.length === 8;

  async function buscarCep() {
    setAviso('');
    setBuscando(true);
    try {
      const dados = await api.get<CepLookupResult>(`/external/cep/${cepDigitos}`);
      update('logradouro', dados.logradouro || form.logradouro);
      update('bairro', dados.bairro || form.bairro);
      update('cidade', dados.cidade || form.cidade);
      update('uf', dados.uf || form.uf);
    } catch (err) {
      setAviso(err instanceof ApiError ? err.message : 'Não foi possível buscar o CEP agora — preencha manualmente.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <TextField
        label="CEP"
        inputMode="numeric"
        value={formatCep(form.cep)}
        onChange={(e) => update('cep', onlyDigits(e.target.value))}
      />
      {cepCompleto ? (
        <Button type="button" variant="secondary" block onClick={buscarCep} disabled={buscando} style={{ marginBottom: 'var(--space-4)' }}>
          {buscando ? 'Buscando…' : '🔍 Preencher endereço pelo CEP'}
        </Button>
      ) : null}
      {aviso ? <div className="alert alert-info">{aviso}</div> : null}

      <TextField label="Logradouro" value={form.logradouro} onChange={(e) => update('logradouro', e.target.value)} />
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ flex: 1 }}>
          <TextField label="Número" value={form.numero} onChange={(e) => update('numero', e.target.value)} />
        </div>
        <div style={{ flex: 2 }}>
          <TextField label="Complemento" value={form.complemento} onChange={(e) => update('complemento', e.target.value)} />
        </div>
      </div>
      <TextField label="Bairro" value={form.bairro} onChange={(e) => update('bairro', e.target.value)} />
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <div style={{ flex: 3 }}>
          <TextField label="Cidade" required value={form.cidade} onChange={(e) => update('cidade', e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <TextField
            label="UF"
            maxLength={2}
            value={form.uf}
            onChange={(e) => update('uf', e.target.value.toUpperCase())}
          />
        </div>
      </div>
    </div>
  );
}
