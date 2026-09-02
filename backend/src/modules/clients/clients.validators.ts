import { z } from 'zod';
import { TipoPessoa, ServicoInteresse, Escala, Turno, EtapaFunil } from '@prisma/client';

const optionalTrimmedString = z.string().trim().optional();

export const createClientSchema = z
  .object({
    // Gerado no device pelo vendedor (obrigatório a partir da etapa offline;
    // por ora aceito e, se ausente, o backend gera). Ver prisma/schema.prisma.
    id: z.string().uuid().optional(),

    tipoPessoa: z.nativeEnum(TipoPessoa),
    cnpjCpf: z.string().min(11, 'CNPJ/CPF inválido'),
    razaoSocial: optionalTrimmedString,
    nomeFantasia: optionalTrimmedString,
    inscricaoEstadual: optionalTrimmedString,
    porte: optionalTrimmedString,

    cep: optionalTrimmedString,
    logradouro: optionalTrimmedString,
    numero: optionalTrimmedString,
    complemento: optionalTrimmedString,
    bairro: optionalTrimmedString,
    cidade: optionalTrimmedString,
    uf: z.string().trim().length(2).optional(),

    nomeContato: optionalTrimmedString,
    cargo: optionalTrimmedString,
    telefone: optionalTrimmedString,
    whatsapp: optionalTrimmedString,
    email: z.string().trim().email('E-mail inválido').optional().or(z.literal('')),

    servicosInteresse: z.array(z.nativeEnum(ServicoInteresse)).default([]),
    qtdPostos: z.number().int().positive().optional(),
    escala: z.nativeEnum(Escala).optional(),
    escalaOutraDescricao: optionalTrimmedString,
    turno: z.nativeEnum(Turno).optional(),
    concorrenteAtual: optionalTrimmedString,
    valorEstimadoMensal: z.number().nonnegative().optional(),
    previsaoDecisao: z.string().datetime().or(z.string().date()).optional(),

    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    observacoes: optionalTrimmedString,

    consentimentoLgpd: z.boolean().default(false),
  })
  .strict();

export type CreateClientInput = z.infer<typeof createClientSchema>;

// cnpjCpf de propósito NÃO entra aqui — é a chave de anti-duplicidade, não
// dá pra deixar o próprio vendedor "corrigir" pra cima do cadastro de outro.
// etapaFunil/motivoPerda só fazem sentido em update (todo cadastro novo
// nasce em NOVO, por padrão do schema), por isso entram só aqui.
export const updateClientSchema = createClientSchema
  .omit({ id: true, cnpjCpf: true })
  .partial()
  .extend({
    etapaFunil: z.nativeEnum(EtapaFunil).optional(),
    motivoPerda: optionalTrimmedString,
  });

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const reassignSchema = z.object({
  vendedorId: z.string().uuid(),
});

export const listClientsQuerySchema = z.object({
  etapaFunil: z.nativeEnum(EtapaFunil).optional(),
  cidade: z.string().trim().optional(),
  servico: z.nativeEnum(ServicoInteresse).optional(),
  vendedorId: z.string().uuid().optional(), // só tem efeito pra supervisor/admin — vendedor sempre vê só o próprio
  busca: z.string().trim().optional(), // razão social / nome fantasia / cnpj-cpf
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const checkDuplicateQuerySchema = z.object({
  cnpjCpf: z.string().min(11),
});
