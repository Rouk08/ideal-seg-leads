import { prisma } from '../../lib/prisma';

// Versão mínima por enquanto: só leitura, com fallback pro default do
// schema caso a linha "default" nunca tenha sido criada (ex.: seed não
// rodou). A tela de gestão de parâmetros (escrita) entra na etapa de
// dashboard/admin.
export async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
  return settings ?? { id: 'default', diasReservaCarteira: 60 };
}
