import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Perfil, TipoPessoa } from '@prisma/client';
import { createApp } from '../src/app';
import * as erpClient from '../src/modules/erp/erp.client';
import { isValidCnpj } from '../src/lib/validators/cpfCnpj';
import { prisma, cleanDb } from './testUtils';

// "Encaminhar para orçamento" fala com um sistema externo real (o ERP em
// idealseg.com) — nos testes isso é sempre mockado, nunca escreve no ERP de
// verdade (ver backend/tests/erp-forward-unconfigured.test.ts pro caso sem
// mock, que testa exatamente o comportamento de "integração não configurada").
// vi.mock é hoisted pro topo do arquivo pelo Vitest, então intercepta mesmo
// os imports estáticos acima.
vi.mock('../src/modules/erp/erp.client', () => ({
  upsertCliente: vi.fn(async (erpClienteId: string | null) => ({ id: erpClienteId ?? 'erp-cliente-novo-123' })),
  montarUrlOrcamento: vi.fn(() => 'https://idealseg.com/admin/orcamentos'),
}));

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

async function criarCliente(token: string, base: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/clients')
    .set(auth(token))
    .send({
      tipoPessoa: TipoPessoa.PJ,
      razaoSocial: `Empresa ${base}`,
      cidade: 'Gaspar',
      servicosInteresse: ['VIGILANCIA_PATRIMONIAL'],
      cnpjCpf: gerarCnpjValido(base),
      ...overrides,
    });
}

beforeEach(async () => {
  await cleanDb();
  vi.clearAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('encaminhar cliente para orçamento (ERP)', () => {
  it('vendedor e supervisor não podem encaminhar — só ADMIN', async () => {
    const supervisor = await criarUsuario('Sup', 'sup@teste.com', Perfil.SUPERVISOR);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenSup = await tokenPara(supervisor.email);
    const tokenVend = await tokenPara(vendedor.email);

    const cliente = await criarCliente(tokenVend, '11222333');

    for (const token of [tokenSup, tokenVend]) {
      const res = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(token));
      expect(res.status).toBe(403);
    }
    expect(erpClient.upsertCliente).not.toHaveBeenCalled();
  });

  it('admin encaminha um cliente pela primeira vez: cria no ERP e grava o vínculo', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVend = await tokenPara(vendedor.email);

    const cliente = await criarCliente(tokenVend, '11222333', {
      nomeFantasia: 'Fantasia Teste',
      email: 'contato@teste.com',
      valorEstimadoMensal: 9800,
    });

    const res = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(tokenAdmin));

    expect(res.status).toBe(200);
    expect(res.body.cliente.erpClienteId).toBe('erp-cliente-novo-123');
    expect(res.body.cliente.encaminhadoErpEm).toBeTruthy();
    expect(res.body.orcamentoUrl).toBe('https://idealseg.com/admin/orcamentos');

    // primeira vez: chamado com erpClienteId = null (cria, não atualiza)
    expect(erpClient.upsertCliente).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ document: cliente.body.cnpjCpf, fantasy_name: 'Fantasia Teste' }),
    );

    // e o vínculo realmente persistiu no banco
    const noBanco = await prisma.cliente.findUnique({ where: { id: cliente.body.id } });
    expect(noBanco?.erpClienteId).toBe('erp-cliente-novo-123');
  });

  it('reencaminhar reaproveita o mesmo erpClienteId — nunca cria duplicata no ERP', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVend = await tokenPara(vendedor.email);

    const cliente = await criarCliente(tokenVend, '11222333');

    const primeiro = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(tokenAdmin));
    expect(primeiro.body.cliente.erpClienteId).toBe('erp-cliente-novo-123');

    const segundo = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(tokenAdmin));
    expect(segundo.status).toBe(200);

    // segunda chamada: erpClienteId já existente é passado (PUT, não POST)
    expect(erpClient.upsertCliente).toHaveBeenLastCalledWith('erp-cliente-novo-123', expect.anything());
  });

  it('admin encaminha cliente de outro vendedor sem restrição (admin enxerga tudo)', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVend = await tokenPara(vendedor.email);

    const cliente = await criarCliente(tokenVend, '11222333');

    const res = await request(app).post(`/api/clients/${cliente.body.id}/encaminhar-orcamento`).set(auth(tokenAdmin));
    expect(res.status).toBe(200);
  });

  it('404 ao tentar encaminhar um cliente inexistente', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const tokenAdmin = await tokenPara(admin.email);

    const res = await request(app)
      .post('/api/clients/00000000-0000-0000-0000-000000000000/encaminhar-orcamento')
      .set(auth(tokenAdmin));
    expect(res.status).toBe(404);
  });
});
