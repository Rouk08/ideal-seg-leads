// Espelha os enums do backend (backend/prisma/schema.prisma). Mantidos
// manualmente em sincronia por ora — se o projeto crescer, dá pra gerar
// isso automaticamente a partir do schema Prisma.

export type Perfil = 'VENDEDOR' | 'SUPERVISOR' | 'ADMIN';

export type TipoPessoa = 'PJ' | 'PF';

export type ServicoInteresse =
  | 'PORTARIA_CONTROLE_ACESSO'
  | 'VIGILANCIA_PATRIMONIAL'
  | 'LIMPEZA_HIGIENIZACAO'
  | 'MANUTENCAO_PREDIAL'
  | 'CONSULTORIA_SEGURANCA'
  | 'MONITORAMENTO';

export const SERVICOS_INTERESSE_LABEL: Record<ServicoInteresse, string> = {
  PORTARIA_CONTROLE_ACESSO: 'Portaria / controle de acesso',
  VIGILANCIA_PATRIMONIAL: 'Vigilância patrimonial',
  LIMPEZA_HIGIENIZACAO: 'Limpeza e higienização',
  MANUTENCAO_PREDIAL: 'Manutenção predial',
  CONSULTORIA_SEGURANCA: 'Consultoria em segurança',
  MONITORAMENTO: 'Monitoramento',
};

export type Escala = 'ESCALA_12X36' | 'ESCALA_44H_SEMANAIS' | 'OUTRA';

export const ESCALA_LABEL: Record<Escala, string> = {
  ESCALA_12X36: '12x36',
  ESCALA_44H_SEMANAIS: '44h semanais',
  OUTRA: 'Outra',
};

export type Turno = 'DIURNO' | 'NOTURNO' | 'H24';

export const TURNO_LABEL: Record<Turno, string> = {
  DIURNO: 'Diurno',
  NOTURNO: 'Noturno',
  H24: '24 horas',
};

export type EtapaFunil =
  | 'NOVO'
  | 'CONTATO_FEITO'
  | 'VISITA_AGENDADA'
  | 'PROPOSTA_ENVIADA'
  | 'NEGOCIACAO'
  | 'GANHO'
  | 'PERDIDO';

export const ETAPA_FUNIL_LABEL: Record<EtapaFunil, string> = {
  NOVO: 'Novo',
  CONTATO_FEITO: 'Contato feito',
  VISITA_AGENDADA: 'Visita agendada',
  PROPOSTA_ENVIADA: 'Proposta enviada',
  NEGOCIACAO: 'Negociação',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export type TipoInteracao = 'LIGACAO' | 'VISITA' | 'WHATSAPP' | 'EMAIL';

export const TIPO_INTERACAO_LABEL: Record<TipoInteracao, string> = {
  LIGACAO: 'Ligação',
  VISITA: 'Visita',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  metaMensal?: string | null;
  percentualComissao?: string | null;
}

export interface Cliente {
  id: string;
  tipoPessoa: TipoPessoa;
  cnpjCpf: string;
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  inscricaoEstadual?: string | null;
  porte?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  nomeContato?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  servicosInteresse: ServicoInteresse[];
  qtdPostos?: number | null;
  escala?: Escala | null;
  escalaOutraDescricao?: string | null;
  turno?: Turno | null;
  concorrenteAtual?: string | null;
  valorEstimadoMensal?: string | null;
  previsaoDecisao?: string | null;
  etapaFunil: EtapaFunil;
  motivoPerda?: string | null;
  vendedorId: string;
  vendedor?: { id: string; nome: string };
  dataCadastro: string;
  reservadoAte?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  fotoFachadaPath?: string | null;
  observacoes?: string | null;
  consentimentoLgpd: boolean;
  dataConsentimento?: string | null;
}

export interface Interacao {
  id: string;
  clienteId: string;
  usuarioId: string;
  usuario?: { id: string; nome: string };
  tipo: TipoInteracao;
  descricao: string;
  data: string;
  proximoPasso?: string | null;
  dataProximoPasso?: string | null;
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  metaMensal?: string | null;
  percentualComissao?: string | null;
  createdAt: string;
}

export type InviteStatus = 'PENDENTE' | 'USADO' | 'EXPIRADO' | 'REVOGADO';

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  PENDENTE: 'Pendente',
  USADO: 'Usado',
  EXPIRADO: 'Expirado',
  REVOGADO: 'Revogado',
};

export interface Invite {
  id: string;
  email: string;
  nome?: string | null;
  perfil: Perfil;
  status: InviteStatus;
  expiresAt: string;
  usedAt?: string | null;
  createdAt: string;
  criadoPor?: { nome: string };
}

export interface DashboardStats {
  totalClientes: number;
  cadastrosNoMes: number;
  porEtapa: Partial<Record<EtapaFunil, number>>;
  taxaConversaoGeral: number | null;
  porVendedor: Array<{
    vendedorId: string;
    vendedorNome: string;
    ativo: boolean;
    total: number;
    ganho: number;
    perdido: number;
    taxaConversao: number | null;
  }>;
  ranking: DashboardStats['porVendedor'];
}

export interface Settings {
  id: string;
  diasReservaCarteira: number;
}
