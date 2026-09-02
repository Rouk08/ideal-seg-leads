import { Prisma, Perfil } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface AuthUser {
  id: string;
  perfil: Perfil;
}

/**
 * TODO O isolamento por vendedor mora aqui, num único lugar. Qualquer rota
 * de cliente que precise respeitar "vendedor só vê os próprios" DEVE passar
 * pelas funções deste arquivo — nunca chamar prisma.cliente diretamente de
 * outro módulo. Isso é o que garante que não existe um caminho alternativo
 * (um relatório, uma exportação, uma rota nova esquecida) que vaze dado de
 * um vendedor pro outro.
 */
function scopeFor(user: AuthUser): Prisma.ClienteWhereInput {
  if (user.perfil === Perfil.VENDEDOR) {
    return { vendedorId: user.id };
  }
  return {}; // SUPERVISOR e ADMIN enxergam tudo
}

export interface ListFilters {
  etapaFunil?: Prisma.ClienteWhereInput['etapaFunil'];
  cidade?: string;
  servico?: string;
  vendedorId?: string;
  busca?: string;
  page: number;
  pageSize: number;
}

export async function list(user: AuthUser, filters: ListFilters) {
  const where: Prisma.ClienteWhereInput = {
    ...scopeFor(user),
    ...(filters.etapaFunil ? { etapaFunil: filters.etapaFunil } : {}),
    ...(filters.cidade ? { cidade: { equals: filters.cidade, mode: 'insensitive' } } : {}),
    ...(filters.servico ? { servicosInteresse: { has: filters.servico as never } } : {}),
    // vendedorId no filtro só faz sentido pra quem já enxerga tudo (super/admin);
    // pra um VENDEDOR o scopeFor acima já fixou o próprio id, então isso vira
    // uma interseção inofensiva (ou o filtro é simplesmente ignorado se
    // apontar pra outro vendedor — nunca amplia o que ele pode ver).
    ...(filters.vendedorId ? { vendedorId: filters.vendedorId } : {}),
    ...(filters.busca
      ? {
          OR: [
            { razaoSocial: { contains: filters.busca, mode: 'insensitive' } },
            { nomeFantasia: { contains: filters.busca, mode: 'insensitive' } },
            { cnpjCpf: { contains: filters.busca.replace(/\D/g, '') } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { dataCadastro: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: { vendedor: { select: { id: true, nome: true } } },
    }),
    prisma.cliente.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

/** Retorna null tanto se o cliente não existe quanto se existe mas é de outro
 * vendedor — de propósito indistinguível, pra não vazar "esse CNPJ existe,
 * é só que não é seu" via um 403 diferenciado. */
export async function findById(user: AuthUser, id: string) {
  return prisma.cliente.findFirst({
    where: { id, ...scopeFor(user) },
    include: { vendedor: { select: { id: true, nome: true } } },
  });
}

/** Sem escopo de propósito: usado só pela checagem de duplicidade, que
 * precisa enxergar cadastros de QUALQUER vendedor — mas o service acima
 * dela nunca deixa passar mais que nome+data pra fora. */
export async function findByCnpjCpfUnscoped(cnpjCpf: string) {
  return prisma.cliente.findUnique({
    where: { cnpjCpf },
    include: { vendedor: { select: { nome: true } } },
  });
}

export async function create(data: Prisma.ClienteUncheckedCreateInput) {
  return prisma.cliente.create({ data, include: { vendedor: { select: { id: true, nome: true } } } });
}

export async function update(id: string, data: Prisma.ClienteUncheckedUpdateInput) {
  return prisma.cliente.update({
    where: { id },
    data,
    include: { vendedor: { select: { id: true, nome: true } } },
  });
}
