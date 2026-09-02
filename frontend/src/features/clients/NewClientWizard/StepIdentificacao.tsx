import { useEffect, useState } from 'react';
import { TextField } from '../../../shared/components/TextField';
import { Button } from '../../../shared/components/Button';
import { formatCpfCnpj, onlyDigits } from '../../../shared/format';
import { isValidCpfCnpj } from '../../../shared/validators/cpfCnpj';
import { api, ApiError } from '../../../shared/api/client';
import type { ClienteFormData } from './draft';

interface CnpjLookupResult {
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  porte: string;
}

interface Props {
  form: ClienteFormData;
  update: <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
  onDuplicidadeChange: (bloqueado: boolean) => void;
}

export function StepIdentificacao({ form, update, onDuplicidadeChange }: Props) {
  const [duplicidade, setDuplicidade] = useState<{ existe: boolean; mensagem?: string } | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [avisoCnpj, setAvisoCnpj] = useState('');

  const digitos = onlyDigits(form.cnpjCpf);
  const tamanhoEsperado = form.tipoPessoa === 'PF' ? 11 : 14;
  const documentoCompleto = digitos.length === tamanhoEsperado;
  const documentoValido = documentoCompleto && isValidCpfCnpj(digitos, form.tipoPessoa);

  // Checagem de duplicidade em tempo real — assim que o documento fica
  // válido, antes mesmo de o vendedor terminar o resto do formulário.
  useEffect(() => {
    if (!documentoValido) {
      setDuplicidade(null);
      onDuplicidadeChange(false);
      return;
    }
    let cancelado = false;
    setVerificando(true);
    const timer = setTimeout(() => {
      api
        .get<{ exists: boolean; message?: string }>('/clients/check-duplicate', { cnpjCpf: digitos })
        .then((res) => {
          if (cancelado) return;
          setDuplicidade({ existe: res.exists, mensagem: res.message });
          onDuplicidadeChange(res.exists);
        })
        .catch(() => {
          if (cancelado) return;
          setDuplicidade(null);
          onDuplicidadeChange(false);
        })
        .finally(() => !cancelado && setVerificando(false));
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digitos, documentoValido]);

  async function buscarCnpj() {
    setAvisoCnpj('');
    setBuscandoCnpj(true);
    try {
      const dados = await api.get<CnpjLookupResult>(`/external/cnpj/${digitos}`);
      update('razaoSocial', dados.razaoSocial || form.razaoSocial);
      update('nomeFantasia', dados.nomeFantasia || form.nomeFantasia);
      update('cep', dados.cep || form.cep);
      update('logradouro', dados.logradouro || form.logradouro);
      update('numero', dados.numero || form.numero);
      update('bairro', dados.bairro || form.bairro);
      update('cidade', dados.cidade || form.cidade);
      update('uf', dados.uf || form.uf);
      update('porte', dados.porte || form.porte);
    } catch (err) {
      setAvisoCnpj(
        err instanceof ApiError ? err.message : 'Não foi possível buscar os dados agora — preencha manualmente.',
      );
    } finally {
      setBuscandoCnpj(false);
    }
  }

  return (
    <div>
      <div className="field">
        <label>Tipo</label>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {(['PJ', 'PF'] as const).map((tipo) => (
            <label key={tipo} className="checkbox-row" style={{ flex: 1 }}>
              <input
                type="radio"
                name="tipoPessoa"
                checked={form.tipoPessoa === tipo}
                onChange={() => update('tipoPessoa', tipo)}
              />
              {tipo === 'PJ' ? 'Pessoa jurídica (CNPJ)' : 'Pessoa física (CPF)'}
            </label>
          ))}
        </div>
      </div>

      <TextField
        label={form.tipoPessoa === 'PF' ? 'CPF' : 'CNPJ'}
        inputMode="numeric"
        required
        value={formatCpfCnpj(form.cnpjCpf)}
        onChange={(e) => update('cnpjCpf', onlyDigits(e.target.value))}
        error={documentoCompleto && !documentoValido ? 'Documento inválido' : undefined}
        hint={verificando ? 'Verificando…' : undefined}
      />

      {duplicidade?.existe ? <div className="alert alert-danger">{duplicidade.mensagem}</div> : null}

      {form.tipoPessoa === 'PJ' && documentoValido && !duplicidade?.existe ? (
        <Button type="button" variant="secondary" block onClick={buscarCnpj} disabled={buscandoCnpj} style={{ marginBottom: 'var(--space-4)' }}>
          {buscandoCnpj ? 'Buscando…' : '🔍 Preencher automaticamente pelo CNPJ'}
        </Button>
      ) : null}
      {avisoCnpj ? <div className="alert alert-info">{avisoCnpj}</div> : null}

      <TextField
        label="Razão social / Nome completo"
        required
        value={form.razaoSocial}
        onChange={(e) => update('razaoSocial', e.target.value)}
      />
      {form.tipoPessoa === 'PJ' && (
        <TextField label="Nome fantasia" value={form.nomeFantasia} onChange={(e) => update('nomeFantasia', e.target.value)} />
      )}
      {form.tipoPessoa === 'PJ' && (
        <TextField
          label="Inscrição estadual"
          value={form.inscricaoEstadual}
          onChange={(e) => update('inscricaoEstadual', e.target.value)}
        />
      )}
      {form.tipoPessoa === 'PJ' && <TextField label="Porte" value={form.porte} onChange={(e) => update('porte', e.target.value)} />}
    </div>
  );
}
