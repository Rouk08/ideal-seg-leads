import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Perfil, TipoPessoa } from '@prisma/client';
import { createApp } from '../src/app';
import { isValidCnpj } from '../src/lib/validators/cpfCnpj';
import { prisma, cleanDb } from './testUtils';

// Sem vi.mock aqui de propósito: backend/.env.test não define ERP_API_URL/
// ERP_SERVICE_USERNAME/ERP_SERVICE_PASSWORD, então este teste passa pelo
// módulo REAL do ERP e confirma que ele falha de forma clara (503) em vez
// de tentar uma chamada de rede — nunca deve escrever no ERP de verdade.
const app = createApp();

function gerarCnpjValido(baseParcial: string): string {
  const base = baseParcial.padEnd(12, '0').slice(0, 12);
  for (let dv1 = 0; dv1 <= 9; dv1++) {
    for (let dv2 = 0; dv2 <= 9; dv2++) {
      const candidato = `${base}${dv1}${dv2}`;
      if (isValidCnpj(candidato)) return candidato;
    }
  }
  throw new Error('não achou CNPJ válido');
}

async function criarUsuario(nome: string, email: string, perfil: Perfil) {
  return prisma.usuario.create({
    data: { nome, email, senhaHash: await argon2.hash('SenhaForte123', { type: argon2.argon2id }), perfil },
  });
}

async function tokenPara(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, senha: 'SenhaForte123' });
  return res.body.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('encaminhar para orçamento sem a integração configurada', () => {
  it('devolve 503 com mensagem clara, sem derrubar o servidor', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVend = await tokenPara(vendedor.email);

    const cliente = await request(app)
      .post('/api/clients')
      .set(auth(tokenVend))
      .send({
        tipoPessoa: TipoPessoa.PJ,
        razaoSocial: 'Empresa Teste',
        cidade: 'Gaspar',
        servicosInteresse: [],
        cnpjCpf: gerarCnpjValido('11222333'),
      });

    const res = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(tokenAdmin));
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/não está configurada/i);
  });
});
