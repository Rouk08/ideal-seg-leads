import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Perfil, TipoPessoa } from '@prisma/client';
import { createApp } from '../src/app';
import { isValidCnpj } from '../src/lib/validators/cpfCnpj';
import { prisma, cleanDb } from './testUtils';

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

async function criarUsuario(nome: string, email: string, perfil: Perfil, extra: Record<string, unknown> = {}) {
  return prisma.usuario.create({
    data: { nome, email, senhaHash: await argon2.hash('SenhaForte123', { type: argon2.argon2id }), perfil, ...extra },
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
      servicosInteresse: [],
      cnpjCpf: gerarCnpjValido(base),
      ...overrides,
    });
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('gestão de usuários', () => {
  it('vendedor não pode listar nem editar usuários', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    const lista = await request(app).get('/api/users').set(auth(token));
    expect(lista.status).toBe(403);

    const editar = await request(app).patch(`/api/users/${vendedor.id}`).set(auth(token)).send({ ativo: false });
    expect(editar.status).toBe(403);
  });

  it('supervisor lista usuários mas não pode editar (só ADMIN edita)', async () => {
    const supervisor = await criarUsuario('Sup', 'sup@teste.com', Perfil.SUPERVISOR);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(supervisor.email);

    const lista = await request(app).get('/api/users').set(auth(token));
    expect(lista.status).toBe(200);
    expect(lista.body.usuarios.length).toBeGreaterThanOrEqual(2);

    const editar = await request(app).patch(`/api/users/${vendedor.id}`).set(auth(token)).send({ ativo: false });
    expect(editar.status).toBe(403);
  });

  it('admin desativa um vendedor sem apagar os clientes dele (regra de negócio #7)', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVendedor = await tokenPara(vendedor.email);

    const criado = await criarCliente(tokenVendedor, '11222333');
    expect(criado.status).toBe(201);

    const desativar = await request(app).patch(`/api/users/${vendedor.id}`).set(auth(tokenAdmin)).send({ ativo: false });
    expect(desativar.status).toBe(200);
    expect(desativar.body.ativo).toBe(false);

    // o cliente continua no banco, vinculado ao mesmo vendedor
    const clienteNoBanco = await prisma.cliente.findUnique({ where: { id: criado.body.id } });
    expect(clienteNoBanco).not.toBeNull();
    expect(clienteNoBanco?.vendedorId).toBe(vendedor.id);

    // vendedor desativado não consegue mais logar
    const tentativaLogin = await request(app).post('/api/auth/login').send({ email: vendedor.email, senha: 'SenhaForte123' });
    expect(tentativaLogin.status).toBe(401);
  });

  it('admin edita meta e comissão de um vendedor', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(admin.email);

    const res = await request(app)
      .patch(`/api/users/${vendedor.id}`)
      .set(auth(token))
      .send({ metaMensal: 20000, percentualComissao: 5 });

    expect(res.status).toBe(200);
    expect(res.body.metaMensal).toBe('20000');
    expect(res.body.percentualComissao).toBe('5');
  });

  it('admin cria um colaborador direto com usuário e senha, sem convite, e ele já loga', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const token = await tokenPara(admin.email);

    const criar = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nome: 'Novo Vendedor', email: 'novo@teste.com', senha: 'SenhaForte123', perfil: 'VENDEDOR' });

    expect(criar.status).toBe(201);
    expect(criar.body.email).toBe('novo@teste.com');
    expect(criar.body.ativo).toBe(true);
    // nunca deve vazar o hash da senha na resposta
    expect(criar.body.senhaHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ email: 'novo@teste.com', senha: 'SenhaForte123' });
    expect(login.status).toBe(200);
  });

  it('não permite criar dois usuários com o mesmo e-mail', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    await criarUsuario('Existente', 'existente@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(admin.email);

    const res = await request(app)
      .post('/api/users')
      .set(auth(token))
      .send({ nome: 'Duplicado', email: 'existente@teste.com', senha: 'SenhaForte123' });

    expect(res.status).toBe(409);
  });

  it('vendedor e supervisor não podem criar usuários (só ADMIN)', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const supervisor = await criarUsuario('Sup', 'sup@teste.com', Perfil.SUPERVISOR);
    const tokenVendedor = await tokenPara(vendedor.email);
    const tokenSupervisor = await tokenPara(supervisor.email);

    for (const token of [tokenVendedor, tokenSupervisor]) {
      const res = await request(app)
        .post('/api/users')
        .set(auth(token))
        .send({ nome: 'X', email: `x-${token.slice(0, 5)}@teste.com`, senha: 'SenhaForte123' });
      expect(res.status).toBe(403);
    }
  });

  it('admin redefine a senha de um colaborador direto pelo painel, sem convite', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);

    const redefinir = await request(app)
      .post(`/api/users/${vendedor.id}/redefinir-senha`)
      .set(auth(tokenAdmin))
      .send({ senha: 'NovaSenhaForte456' });
    expect(redefinir.status).toBe(204);

    const loginSenhaAntiga = await request(app).post('/api/auth/login').send({ email: vendedor.email, senha: 'SenhaForte123' });
    expect(loginSenhaAntiga.status).toBe(401);

    const loginSenhaNova = await request(app).post('/api/auth/login').send({ email: vendedor.email, senha: 'NovaSenhaForte456' });
    expect(loginSenhaNova.status).toBe(200);
  });
});

describe('parâmetros (settings)', () => {
  it('vendedor não pode ler nem editar parâmetros', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    expect((await request(app).get('/api/settings').set(auth(token))).status).toBe(403);
    expect((await request(app).patch('/api/settings').set(auth(token)).send({ diasReservaCarteira: 30 })).status).toBe(403);
  });

  it('admin altera os dias de reserva de carteira e isso passa a valer pra novos cadastros', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenVendedor = await tokenPara(vendedor.email);

    const atualizar = await request(app).patch('/api/settings').set(auth(tokenAdmin)).send({ diasReservaCarteira: 15 });
    expect(atualizar.status).toBe(200);
    expect(atualizar.body.diasReservaCarteira).toBe(15);

    const criado = await criarCliente(tokenVendedor, '22333444');
    const reservadoAte = new Date(criado.body.reservadoAte);
    const dataCadastro = new Date(criado.body.dataCadastro);
    const diffDias = Math.round((reservadoAte.getTime() - dataCadastro.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDias).toBe(15);
  });
});

describe('dashboard', () => {
  it('vendedor não acessa o dashboard', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);
    const res = await request(app).get('/api/dashboard/stats').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('agrega cadastros por vendedor, funil consolidado e taxa de conversão', async () => {
    const supervisor = await criarUsuario('Sup', 'sup@teste.com', Perfil.SUPERVISOR);
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenSup = await tokenPara(supervisor.email);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    const c1 = await criarCliente(tokenA, '11222333');
    const c2 = await criarCliente(tokenA, '22333444');
    await criarCliente(tokenB, '33444555');

    await request(app).patch(`/api/clients/${c1.body.id}`).set(auth(tokenA)).send({ etapaFunil: 'GANHO' });
    await request(app).patch(`/api/clients/${c2.body.id}`).set(auth(tokenA)).send({ etapaFunil: 'PERDIDO' });

    const res = await request(app).get('/api/dashboard/stats').set(auth(tokenSup));
    expect(res.status).toBe(200);
    expect(res.body.totalClientes).toBe(3);
    expect(res.body.porEtapa.GANHO).toBe(1);
    expect(res.body.porEtapa.PERDIDO).toBe(1);
    expect(res.body.porEtapa.NOVO).toBe(1);

    const statsA = res.body.porVendedor.find((v: { vendedorId: string }) => v.vendedorId === vendedorA.id);
    expect(statsA.total).toBe(2);
    expect(statsA.ganho).toBe(1);
    expect(statsA.perdido).toBe(1);
    expect(statsA.taxaConversao).toBe(50); // 1 ganho de 2 decididos

    // ranking ordenado por total desc — vendedor A (2) vem antes do B (1)
    const posA = res.body.ranking.findIndex((v: { vendedorId: string }) => v.vendedorId === vendedorA.id);
    const posB = res.body.ranking.findIndex((v: { vendedorId: string }) => v.vendedorId === vendedorB.id);
    expect(posA).toBeLessThan(posB);
  });
});

describe('exportação CSV', () => {
  it('vendedor exporta só os próprios clientes, nunca os de outro vendedor', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    await criarCliente(tokenA, '11222333', { razaoSocial: 'Empresa Exclusiva De A' });
    await criarCliente(tokenB, '22333444', { razaoSocial: 'Empresa Exclusiva De B' });

    const csvA = await request(app).get('/api/clients/export').set(auth(tokenA));
    expect(csvA.status).toBe(200);
    expect(csvA.headers['content-type']).toMatch(/text\/csv/);
    expect(csvA.text).toMatch(/Empresa Exclusiva De A/);
    expect(csvA.text).not.toMatch(/Empresa Exclusiva De B/);
  });

  it('admin exporta clientes de todos os vendedores', async () => {
    const admin = await criarUsuario('Admin', 'admin@teste.com', Perfil.ADMIN);
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenAdmin = await tokenPara(admin.email);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    await criarCliente(tokenA, '11222333', { razaoSocial: 'Empresa Exclusiva De A' });
    await criarCliente(tokenB, '22333444', { razaoSocial: 'Empresa Exclusiva De B' });

    const csv = await request(app).get('/api/clients/export').set(auth(tokenAdmin));
    expect(csv.text).toMatch(/Empresa Exclusiva De A/);
    expect(csv.text).toMatch(/Empresa Exclusiva De B/);
  });
});
