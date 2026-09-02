import * as clientsRepo from './clients.repository';
import type { AuthUser } from './clients.repository';
import { getSettings } from '../settings/settings.service';
import { isValidCpfCnpj, onlyDigits } from '../../lib/validators/cpfCnpj';
import { isValidBrazilianPhone } from '../../lib/validators/phone';
import { HttpError } from '../../middlewares/errorHandler';
import { recordAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { defaultStorage } from '../../lib/storage';
import type { CreateClientInput, UpdateClientInput } from './clients.validators';

function formatDataCadastro(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function validateDocOrThrow(cnpjCpf: string, tipoPessoa: 'PF' | 'PJ') {
  if (!isValidCpfCnpj(cnpjCpf, tipoPessoa)) {
    throw new HttpError(400, tipoPessoa === 'PF' ? 'CPF inválido' : 'CNPJ inválido');
  }
}

function validatePhonesOrThrow(input: Pick<CreateClientInput, 'telefone' | 'whatsapp'>) {
  if (input.telefone && !isValidBrazilianPhone(input.telefone)) {
    throw new HttpError(400, 'Telefone inválido');
  }
  if (input.whatsapp && !isValidBrazilianPhone(input.whatsapp)) {
    throw new HttpError(400, 'WhatsApp inválido');
  }
}

/**
 * Checagem de duplicidade "amigável", usada tanto no formulário (antes de
 * enviar) quanto internamente no create. De propósito devolve só nome de
 * quem cadastrou + data — nunca o restante dos dados do lead alheio.
 */
export async function checkDuplicate(rawCnpjCpf: string) {
  const cnpjCpf = onlyDigits(rawCnpjCpf);
  const existente = await clientsRepo.findByCnpjCpfUnscoped(cnpjCpf);

  if (!existente) {
    return { exists: false as const };
  }

  return {
    exists: true as const,
    message: `Cliente já cadastrado por ${existente.vendedor.nome} em ${formatDataCadastro(existente.dataCadastro)}`,
    cadastradoPorNome: existente.vendedor.nome,
    dataCadastro: existente.dataCadastro,
  };
}

export async function create(user: AuthUser, input: CreateClientInput) {
  const cnpjCpf = onlyDigits(input.cnpjCpf);
  validateDocOrThrow(cnpjCpf, input.tipoPessoa);
  validatePhonesOrThrow(input);

  const duplicado = await checkDuplicate(cnpjCpf);
  if (duplicado.exists) {
    throw new HttpError(409, duplicado.message);
  }

  const settings = await getSettings();
  const reservadoAte = new Date(Date.now() + settings.diasReservaCarteira * 24 * 60 * 60 * 1000);

  const cliente = await clientsRepo.create({
    ...(input.id ? { id: input.id } : {}),
    tipoPessoa: input.tipoPessoa,
    cnpjCpf,
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia,
    inscricaoEstadual: input.inscricaoEstadual,
    porte: input.porte,
    cep: input.cep ? onlyDigits(input.cep) : undefined,
    logradouro: input.logradouro,
    numero: input.numero,
    complemento: input.complemento,
    bairro: input.bairro,
    cidade: input.cidade,
    uf: input.uf?.toUpperCase(),
    nomeContato: input.nomeContato,
    cargo: input.cargo,
    telefone: input.telefone ? onlyDigits(input.telefone) : undefined,
    whatsapp: input.whatsapp ? onlyDigits(input.whatsapp) : undefined,
    email: input.email || undefined,
    servicosInteresse: input.servicosInteresse,
    qtdPostos: input.qtdPostos,
    escala: input.escala,
    escalaOutraDescricao: input.escalaOutraDescricao,
    turno: input.turno,
    concorrenteAtual: input.concorrenteAtual,
    valorEstimadoMensal: input.valorEstimadoMensal,
    previsaoDecisao: input.previsaoDecisao ? new Date(input.previsaoDecisao) : undefined,
    latitude: input.latitude,
    longitude: input.longitude,
    observacoes: input.observacoes,
    consentimentoLgpd: input.consentimentoLgpd,
    dataConsentimento: input.consentimentoLgpd ? new Date() : undefined,
    vendedorId: user.id,
    reservadoAte,
  });

  await recordAudit({
    usuarioId: user.id,
    acao: 'cliente.criar',
    entidade: 'Cliente',
    entidadeId: cliente.id,
    depois: { cnpjCpf, razaoSocial: cliente.razaoSocial, cidade: cliente.cidade },
  });

  return cliente;
}

export async function get(user: AuthUser, id: string) {
  const cliente = await clientsRepo.findById(user, id);
  if (!cliente) {
    throw new HttpError(404, 'Cliente não encontrado');
  }
  return cliente;
}

export async function list(user: AuthUser, filters: Parameters<typeof clientsRepo.list>[1]) {
  return clientsRepo.list(user, filters);
}

export async function update(user: AuthUser, id: string, input: UpdateClientInput) {
  const atual = await get(user, id); // 404 se não existe OU não pertence a este vendedor

  if (input.telefone || input.whatsapp) {
    validatePhonesOrThrow(input);
  }

  const atualizado = await clientsRepo.update(id, {
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia,
    inscricaoEstadual: input.inscricaoEstadual,
    porte: input.porte,
    cep: input.cep ? onlyDigits(input.cep) : undefined,
    logradouro: input.logradouro,
    numero: input.numero,
    complemento: input.complemento,
    bairro: input.bairro,
    cidade: input.cidade,
    uf: input.uf?.toUpperCase(),
    nomeContato: input.nomeContato,
    cargo: input.cargo,
    telefone: input.telefone ? onlyDigits(input.telefone) : undefined,
    whatsapp: input.whatsapp ? onlyDigits(input.whatsapp) : undefined,
    email: input.email || undefined,
    servicosInteresse: input.servicosInteresse,
    qtdPostos: input.qtdPostos,
    escala: input.escala,
    escalaOutraDescricao: input.escalaOutraDescricao,
    turno: input.turno,
    concorrenteAtual: input.concorrenteAtual,
    valorEstimadoMensal: input.valorEstimadoMensal,
    previsaoDecisao: input.previsaoDecisao ? new Date(input.previsaoDecisao) : undefined,
    etapaFunil: input.etapaFunil,
    motivoPerda: input.motivoPerda,
    latitude: input.latitude,
    longitude: input.longitude,
    observacoes: input.observacoes,
    consentimentoLgpd: input.consentimentoLgpd,
    dataConsentimento: input.consentimentoLgpd && !atual.dataConsentimento ? new Date() : undefined,
  });

  await recordAudit({
    usuarioId: user.id,
    acao: 'cliente.atualizar',
    entidade: 'Cliente',
    entidadeId: id,
    antes: { etapaFunil: atual.etapaFunil, cidade: atual.cidade },
    depois: { etapaFunil: atualizado.etapaFunil, cidade: atualizado.cidade },
  });

  return atualizado;
}

/**
 * Reatribuição de carteira — só SUPERVISOR/ADMIN chegam aqui (garantido na
 * rota). Não usa clientsRepo.findById (que aplicaria escopo de vendedor);
 * supervisor/admin já enxergam tudo, então um findById "sem escopo" aqui é
 * seguro e intencional.
 */
export async function reassign(user: AuthUser, id: string, novoVendedorId: string) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) {
    throw new HttpError(404, 'Cliente não encontrado');
  }

  const novoVendedor = await prisma.usuario.findUnique({ where: { id: novoVendedorId } });
  if (!novoVendedor || !novoVendedor.ativo) {
    throw new HttpError(400, 'Vendedor de destino inválido ou inativo');
  }

  const settings = await getSettings();
  const reservadoAte = new Date(Date.now() + settings.diasReservaCarteira * 24 * 60 * 60 * 1000);

  const atualizado = await clientsRepo.update(id, { vendedorId: novoVendedorId, reservadoAte });

  await recordAudit({
    usuarioId: user.id,
    acao: 'cliente.reatribuir',
    entidade: 'Cliente',
    entidadeId: id,
    antes: { vendedorId: cliente.vendedorId },
    depois: { vendedorId: novoVendedorId },
  });

  return atualizado;
}

const FOTO_MAX_BYTES = 8 * 1024 * 1024; // 8MB — a compressão de verdade acontece no client (etapa mobile)
const FOTO_MIME_ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function uploadFoto(user: AuthUser, id: string, file: Express.Multer.File) {
  const cliente = await get(user, id);

  if (!FOTO_MIME_ALLOWED.has(file.mimetype)) {
    throw new HttpError(400, 'Formato de imagem não suportado (use JPEG, PNG ou WebP)');
  }
  if (file.size > FOTO_MAX_BYTES) {
    throw new HttpError(400, 'Imagem muito grande (máximo 8MB)');
  }

  const novoPath = await defaultStorage.save(file.buffer, file.originalname, 'clientes');

  if (cliente.fotoFachadaPath) {
    await defaultStorage.delete(cliente.fotoFachadaPath);
  }

  return clientsRepo.update(id, { fotoFachadaPath: novoPath });
}

export async function getFotoBuffer(user: AuthUser, id: string): Promise<{ buffer: Buffer; path: string }> {
  const cliente = await get(user, id);
  if (!cliente.fotoFachadaPath) {
    throw new HttpError(404, 'Este cliente não tem foto cadastrada');
  }
  const buffer = await defaultStorage.read(cliente.fotoFachadaPath);
  return { buffer, path: cliente.fotoFachadaPath };
}
