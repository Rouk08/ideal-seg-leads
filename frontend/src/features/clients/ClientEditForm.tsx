import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../shared/api/client';
import type { Cliente, Escala, Turno } from '../../shared/types';
import { onlyDigits } from '../../shared/format';
import { TextField, TextAreaField } from '../../shared/components/TextField';
import { Button } from '../../shared/components/Button';
// Reaproveita os mesmos passos do cadastro (endereço/contato/qualificação) —
// são componentes agnósticos de "criar vs editar", só recebem form+update.
// Identificação NÃO é reaproveitada: lá ela lida com CNPJ/CPF e checagem de
// duplicidade, que não fazem sentido aqui (documento é imutável após criado).
import { StepEndereco } from './NewClientWizard/StepEndereco';
import { StepContato } from './NewClientWizard/StepContato';
import { StepQualificacao } from './NewClientWizard/StepQualificacao';
import type { ClienteFormData } from './NewClientWizard/draft';

// O admin edita "tudo, exceto o que não pode mudar": tipo de pessoa e
// CNPJ/CPF são a identidade do cadastro (chave de anti-duplicidade) e ficam
// de fora — pra trocar documento, o certo é reatribuir/recriar, não editar.
type CampoEditavel = Exclude<keyof ClienteFormData, 'id' | 'tipoPessoa' | 'cnpjCpf' | 'consentimentoLgpd'>;
type FormEdicao = Pick<ClienteFormData, CampoEditavel>;

function clienteParaForm(c: Cliente): FormEdicao {
  return {
    razaoSocial: c.razaoSocial ?? '',
    nomeFantasia: c.nomeFantasia ?? '',
    inscricaoEstadual: c.inscricaoEstadual ?? '',
    porte: c.porte ?? '',
    cep: c.cep ?? '',
    logradouro: c.logradouro ?? '',
    numero: c.numero ?? '',
    complemento: c.complemento ?? '',
    bairro: c.bairro ?? '',
    cidade: c.cidade ?? '',
    uf: c.uf ?? '',
    nomeContato: c.nomeContato ?? '',
    cargo: c.cargo ?? '',
    telefone: c.telefone ?? '',
    whatsapp: c.whatsapp ?? '',
    email: c.email ?? '',
    servicosInteresse: c.servicosInteresse,
    qtdPostos: c.qtdPostos != null ? String(c.qtdPostos) : '',
    escala: (c.escala as Escala | null) ?? '',
    escalaOutraDescricao: c.escalaOutraDescricao ?? '',
    turno: (c.turno as Turno | null) ?? '',
    concorrenteAtual: c.concorrenteAtual ?? '',
    valorEstimadoMensal: c.valorEstimadoMensal != null ? String(c.valorEstimadoMensal) : '',
    previsaoDecisao: c.previsaoDecisao ? c.previsaoDecisao.slice(0, 10) : '',
    latitude: c.latitude != null ? Number(c.latitude) : null,
    longitude: c.longitude != null ? Number(c.longitude) : null,
    observacoes: c.observacoes ?? '',
  };
}

interface Props {
  cliente: Cliente;
  onSalvo: (atualizado: Cliente) => void;
  onCancelar: () => void;
}

export function ClientEditForm({ cliente, onSalvo, onCancelar }: Props) {
  const [form, setForm] = useState<FormEdicao>(() => clienteParaForm(cliente));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function update<K extends CampoEditavel>(campo: K, valor: FormEdicao[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);

    const payload = {
      razaoSocial: form.razaoSocial || undefined,
      nomeFantasia: form.nomeFantasia || undefined,
      inscricaoEstadual: form.inscricaoEstadual || undefined,
      porte: form.porte || undefined,
      cep: form.cep ? onlyDigits(form.cep) : undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      uf: form.uf || undefined,
      nomeContato: form.nomeContato || undefined,
      cargo: form.cargo || undefined,
      telefone: form.telefone || undefined,
      whatsapp: form.whatsapp || undefined,
      email: form.email || undefined,
      servicosInteresse: form.servicosInteresse,
      qtdPostos: form.qtdPostos ? Number(form.qtdPostos) : undefined,
      escala: form.escala || undefined,
      escalaOutraDescricao: form.escalaOutraDescricao || undefined,
      turno: form.turno || undefined,
      concorrenteAtual: form.concorrenteAtual || undefined,
      valorEstimadoMensal: form.valorEstimadoMensal ? Number(form.valorEstimadoMensal) : undefined,
      previsaoDecisao: form.previsaoDecisao || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      observacoes: form.observacoes || undefined,
    };

    try {
      const atualizado = await api.patch<Cliente>(`/clients/${cliente.id}`, payload);
      onSalvo(atualizado);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  // update() do formulário de edição só aceita os campos editáveis — os Step*
  // reaproveitados pedem um `update` compatível com ClienteFormData inteiro,
  // então repassamos o mesmo objeto (id/tipoPessoa/cnpjCpf/consentimentoLgpd
  // nunca são tocados por eles, então o cast é seguro).
  const updateCompat = update as <K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) => void;
  const formCompat = form as ClienteFormData;

  return (
    <form onSubmit={salvar} className="card">
      <h3 style={{ marginTop: 0 }}>Editar cadastro</h3>

      <TextField label="Razão social / Nome completo" value={form.razaoSocial} onChange={(e) => update('razaoSocial', e.target.value)} />
      <TextField label="Nome fantasia" value={form.nomeFantasia} onChange={(e) => update('nomeFantasia', e.target.value)} />
      <TextField label="Inscrição estadual" value={form.inscricaoEstadual} onChange={(e) => update('inscricaoEstadual', e.target.value)} />
      <TextField label="Porte" value={form.porte} onChange={(e) => update('porte', e.target.value)} />

      <h4>Endereço</h4>
      <StepEndereco form={formCompat} update={updateCompat} />

      <h4>Contato</h4>
      <StepContato form={formCompat} update={updateCompat} />

      <h4>Qualificação</h4>
      <StepQualificacao form={formCompat} update={updateCompat} />

      <TextAreaField label="Observações" value={form.observacoes} onChange={(e) => update('observacoes', e.target.value)} />

      {erro ? <div className="alert alert-danger">{erro}</div> : null}

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" block disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
