import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../lib/audit';

// Fallback pro default do schema caso a linha "default" nunca tenha sido
// criada (ex.: seed não rodou).
export async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  return settings ?? { id: 'default', diasReservaCarteira: 60, updatedAt: new Date() };
}

export async function updateSettings(adminId: string, diasReservaCarteira: number) {
  const anterior = await getSettings();

  const atualizado = await prisma.settings.upsert({
    where: { id: 'default' },
    update: { diasReservaCarteira },
    create: { id: 'default', diasReservaCarteira },
  });

  await recordAudit({
    usuarioId: adminId,
    acao: 'settings.atualizar',
    entidade: 'Settings',
    entidadeId: 'default',
    antes: { diasReservaCarteira: anterior.diasReservaCarteira },
    depois: { diasReservaCarteira: atualizado.diasReservaCarteira },
  });

  return atualizado;
}
