import { useEffect, useRef, useState } from 'react';
import type { Escala, ServicoInteresse, TipoPessoa, Turno } from '../../../shared/types';

// Único rascunho de cada vez — suficiente pra "salvamento automático" nesta
// etapa. A fila offline de verdade (múltiplos cadastros pendentes, retry,
// idempotência por id) é a próxima etapa; isto aqui só evita perder o que
// foi digitado se o vendedor sair da tela no meio do preenchimento.
const DRAFT_KEY = 'ideal-seg-leads:draft-novo-cliente';

export interface ClienteFormData {
  id: string; // gerado uma vez, no início do wizard — vira o Cliente.id real no backend
  tipoPessoa: TipoPessoa;
  cnpjCpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  inscricaoEstadual: string;
  porte: string;

  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;

  nomeContato: string;
  cargo: string;
  telefone: string;
  whatsapp: string;
  email: string;

  servicosInteresse: ServicoInteresse[];
  qtdPostos: string;
  escala: Escala | '';
  escalaOutraDescricao: string;
  turno: Turno | '';
  concorrenteAtual: string;
  valorEstimadoMensal: string;
  previsaoDecisao: string;

  latitude: number | null;
  longitude: number | null;
  observacoes: string;
  consentimentoLgpd: boolean;
}

export function novoFormularioVazio(): ClienteFormData {
  return {
    id: crypto.randomUUID(),
    tipoPessoa: 'PJ',
    cnpjCpf: '',
    razaoSocial: '',
    nomeFantasia: '',
    inscricaoEstadual: '',
    porte: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    nomeContato: '',
    cargo: '',
    telefone: '',
    whatsapp: '',
    email: '',
    servicosInteresse: [],
    qtdPostos: '',
    escala: '',
    escalaOutraDescricao: '',
    turno: '',
    concorrenteAtual: '',
    valorEstimadoMensal: '',
    previsaoDecisao: '',
    latitude: null,
    longitude: null,
    observacoes: '',
    consentimentoLgpd: false,
  };
}

function carregarRascunho(): ClienteFormData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClienteFormData;
  } catch {
    return null;
  }
}

export function limparRascunho() {
  localStorage.removeItem(DRAFT_KEY);
}

/**
 * Estado do formulário com salvamento automático em localStorage a cada
 * mudança (debounced). Se existir um rascunho ao montar, ele é recuperado
 * silenciosamente — quem chama decide se mostra um aviso.
 */
export function useClienteDraft() {
  const rascunhoExistente = useRef(carregarRascunho());
  const [recuperouRascunho] = useState(() => rascunhoExistente.current !== null);
  const [form, setForm] = useState<ClienteFormData>(() => rascunhoExistente.current ?? novoFormularioVazio());

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    }, 400);
    return () => clearTimeout(timer);
  }, [form]);

  function update<K extends keyof ClienteFormData>(campo: K, valor: ClienteFormData[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function descartar() {
    limparRascunho();
    setForm(novoFormularioVazio());
  }

  return { form, update, setForm, descartar, recuperouRascunho };
}
