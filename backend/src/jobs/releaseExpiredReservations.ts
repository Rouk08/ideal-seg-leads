import { prisma } from '../lib/prisma';

/**
 * Regra de negócio #2: sem interação registrada dentro do prazo de reserva,
 * o lead "volta pro pool" — na prática, isso significa limpar reservadoAte
 * (null = não protegido), deixando claro pro supervisor que esse cliente
 * está livre pra reatribuição. O vendedor original continua sendo o
 * vendedorId até uma reatribuição explícita; a proteção de exclusividade
 * é o que expira, não a posse.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await prisma.cliente.updateMany({
    where: { reservadoAte: { lt: new Date() } },
    data: { reservadoAte: null },
  });

  if (result.count > 0) {
    // eslint-disable-next-line no-console
    console.log(`[job] ${result.count} reserva(s) de carteira liberada(s) por expiração`);
  }

  return result.count;
}
