import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '../../../shared/components/TopBar';
import { Stepper } from '../../../shared/components/Stepper';
import { Button } from '../../../shared/components/Button';
import { api, ApiError } from '../../../shared/api/client';
import { onlyDigits } from '../../../shared/format';
import { isValidCpfCnpj } from '../../../shared/validators/cpfCnpj';
import type { Cliente } from '../../../shared/types';
import { useClienteDraft, limparRascunho } from './draft';
import { StepIdentificacao } from './StepIdentificacao';
import { StepEndereco } from './StepEndereco';
import { StepContato } from './StepContato';
import { StepQualificacao } from './StepQualificacao';
import { StepEvidencias } from './StepEvidencias';

const TITULOS = ['Identificação', 'Endereço', 'Contato', 'Qualificação', 'Evidências'];

export function NewClientWizard() {
  const navigate = useNavigate();
  const { form, update, descartar, recuperouRascunho } = useClienteDraft();
  const [passo, setPasso] = useState(0);
  const [foto, setFoto] = useState<File | null>(null);
  const [duplicidadeBloqueada, setDuplicidadeBloqueada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [avisoRascunho, setAvisoRascunho] = useState(recuperouRascunho);

  const documentoValido = isValidCpfCnpj(onlyDigits(form.cnpjCpf), form.tipoPessoa);
  const podeAvancarDoStep0 = documentoValido && form.razaoSocial.trim().length > 1 && !duplicidadeBloqueada;

  function proximo() {
    setPasso((p) => Math.min(p + 1, TITULOS.length - 1));
  }
  function voltar() {
    setPasso((p) => Math.max(p - 1, 0));
  }

  async function cadastrar() {
    setErroEnvio('');
    setEnviando(true);
    try {
      const payload = {
        id: form.id,
        tipoPessoa: form.tipoPessoa,
        cnpjCpf: onlyDigits(form.cnpjCpf),
        razaoSocial: form.razaoSocial || undefined,
        nomeFantasia: form.nomeFantasia || undefined,
        inscricaoEstadual: form.inscricaoEstadual || undefined,
        porte: form.porte || undefined,
        cep: form.cep || undefined,
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
        consentimentoLgpd: form.consentimentoLgpd,
      };

      const cliente = await api.post<Cliente>('/clients', payload);

      if (foto) {
        const formData = new FormData();
        formData.append('foto', foto);
        try {
          await api.postForm(`/clients/${cliente.id}/foto`, formData);
        } catch {
          // cliente já foi criado com sucesso — a foto pode ser adicionada
          // depois na tela de detalhe, não é motivo pra travar o fluxo
        }
      }

      limparRascunho();
      navigate(`/clientes/${cliente.id}`, { state: { criado: true } });
    } catch (err) {
      setErroEnvio(err instanceof ApiError ? err.message : 'Não foi possível cadastrar. Verifique sua conexão e tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="app-shell">
      <TopBar title={`Novo cliente — ${TITULOS[passo]}`} back />
      <main className="app-main">
        {avisoRascunho ? (
          <div className="alert alert-info">
            Recuperamos um rascunho que você tinha começado.{' '}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ minHeight: 'auto', padding: 0, textDecoration: 'underline' }}
              onClick={() => {
                descartar();
                setFoto(null);
                setPasso(0);
                setAvisoRascunho(false);
              }}
            >
              Começar do zero
            </button>
          </div>
        ) : null}

        <Stepper total={TITULOS.length} current={passo} />

        {passo === 0 && <StepIdentificacao form={form} update={update} onDuplicidadeChange={setDuplicidadeBloqueada} />}
        {passo === 1 && <StepEndereco form={form} update={update} />}
        {passo === 2 && <StepContato form={form} update={update} />}
        {passo === 3 && <StepQualificacao form={form} update={update} />}
        {passo === 4 && <StepEvidencias form={form} update={update} foto={foto} onFotoChange={setFoto} />}

        {erroEnvio ? <div className="alert alert-danger">{erroEnvio}</div> : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          {passo > 0 ? (
            <Button type="button" variant="secondary" onClick={voltar} disabled={enviando}>
              Voltar
            </Button>
          ) : null}

          {passo < TITULOS.length - 1 ? (
            <Button type="button" block onClick={proximo} disabled={passo === 0 && !podeAvancarDoStep0}>
              Avançar
            </Button>
          ) : (
            <Button type="button" block onClick={cadastrar} disabled={enviando}>
              {enviando ? 'Cadastrando…' : 'Cadastrar cliente'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
