import { prisma } from '../../lib/prisma';
import { get as getCliente } from '../clients/clients.service';
import type { AuthUser } from '../clients/clients.repository';
import { getSettings } from '../settings/settings.service';
import { recordAudit } from '../../lib/audit';
import { HttpError } from '../../middlewares/errorHandler';
import type { CreateInteractionInput } from './interactions.validators';

export async function list(user: AuthUser, clienteId: string) {
  await getCliente(user, clienteId); // 404 se o cliente não existe ou não é acessível a este usuário
  return prisma.interacao.findMany({
    where: { clienteId },
    orderBy: { data: 'desc' },
    include: { usuario: { select: { id: true, nome: true } } },
  });
}

/**
 * Regra de negócio #2: registrar uma interação é o que mantém a reserva de
 * carteira viva. Toda criação de interação renova reservadoAte a partir de
 * agora — é assim que "sem interação no período, volta pro pool" é
 * garantido, sem precisar de nenhuma lógica extra no formulário do vendedor.
 */
export async function create(user: AuthUser, clienteId: string, input: CreateInteractionInput) {
  await getCliente(user, clienteId);

  // Mesma idempotência de sincronização do Cliente (regra de negócio #6):
  // reenviar a mesma interação (mesmo id, gerado no aparelho) depois de uma
  // falha de rede não deve criar uma segunda linha nem renovar a reserva
  // duas vezes — só devolve a que já existe.
  if (input.id) {
    const existente = await prisma.interacao.findUnique({
      where: { id: input.id },
      include: { usuario: { select: { id: true, nome: true } } },
    });
    if (existente) {
      if (existente.usuarioId !== user.id || existente.clienteId !== clienteId) {
        throw new HttpError(409, 'Esta interação já existe e pertence a outro registro.');
      }
      return existente;
    }
  }

  const settings = await getSettings();
  const reservadoAte = new Date(Date.now() + settings.diasReservaCarteira * 24 * 60 * 60 * 1000);

  const [interacao] = await prisma.$transaction([
    prisma.interacao.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        clienteId,
        usuarioId: user.id,
        tipo: input.tipo,
        descricao: input.descricao,
        data: input.data ? new Date(input.data) : new Date(),
        proximoPasso: input.proximoPasso,
        dataProximoPasso: input.dataProximoPasso ? new Date(input.dataProximoPasso) : undefined,
      },
      include: { usuario: { select: { id: true, nome: true } } },
    }),
    prisma.cliente.update({ where: { id: clienteId }, data: { reservadoAte } }),
  ]);

  await recordAudit({
    usuarioId: user.id,
    acao: 'interacao.criar',
    entidade: 'Interacao',
    entidadeId: interacao.id,
    depois: { clienteId, tipo: input.tipo },
  });

  return interacao;
}
