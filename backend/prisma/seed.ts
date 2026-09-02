import { PrismaClient, Perfil } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// Seed mínimo desta etapa: só o suficiente para existir um ADMIN capaz de
// gerar convites e testar o fluxo de auth. O seed completo (3 usuários de
// cada perfil + 10 clientes fictícios de Gaspar/Blumenau) entra na etapa de
// CRUD de cliente, quando o modelo Cliente já tiver validação/serviço prontos.
async function main() {
  const senhaAdmin = process.env.SEED_ADMIN_SENHA ?? 'TrocarSenha123!';

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@idealseg.com.br' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@idealseg.com.br',
      senhaHash: await argon2.hash(senhaAdmin, { type: argon2.argon2id }),
      perfil: Perfil.ADMIN,
      ativo: true,
    },
  });

  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', diasReservaCarteira: 60 },
  });

  console.log('Seed concluído.');
  console.log(`Admin: ${admin.email} / senha: ${senhaAdmin}`);
  console.log('=> troque a senha assim que fizer o primeiro login.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
