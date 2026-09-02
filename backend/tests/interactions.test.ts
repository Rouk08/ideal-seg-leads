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

describe('interações', () => {
  it('registrar uma interação renova a reserva de carteira do cliente', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(token))
      .send({
        tipoPessoa: TipoPessoa.PJ,
        razaoSocial: 'Empresa X',
        cidade: 'Gaspar',
        servicosInteresse: [],
        cnpjCpf: gerarCnpjValido('11222333'),
      });
    const clienteId = criado.body.id as string;

    // força a reserva pra uma data já vencida, simulando o job de expiração
    await prisma.cliente.update({ where: { id: clienteId }, data: { reservadoAte: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post(`/api/clients/${clienteId}/interacoes`)
      .set(auth(token))
      .send({ tipo: 'VISITA', descricao: 'Visita de apresentação' });

    expect(res.status).toBe(201);

    const clienteAtualizado = await prisma.cliente.findUnique({ where: { id: clienteId } });
    expect(clienteAtualizado?.reservadoAte).not.toBeNull();
    expect(clienteAtualizado!.reservadoAte!.getTime()).toBeGreaterThan(Date.now());
  });

  it('vendedor B não consegue ver nem criar interação num cliente do vendedor A', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({
        tipoPessoa: TipoPessoa.PJ,
        razaoSocial: 'Empresa Y',
        cidade: 'Gaspar',
        servicosInteresse: [],
        cnpjCpf: gerarCnpjValido('22333444'),
      });
    const clienteId = criado.body.id as string;

    const listB = await request(app).get(`/api/clients/${clienteId}/interacoes`).set(auth(tokenB));
    expect(listB.status).toBe(404);

    const createB = await request(app)
      .post(`/api/clients/${clienteId}/interacoes`)
      .set(auth(tokenB))
      .send({ tipo: 'LIGACAO', descricao: 'tentando registrar em cliente alheio' });
    expect(createB.status).toBe(404);

    const interacoesNoBanco = await prisma.interacao.count({ where: { clienteId } });
    expect(interacoesNoBanco).toBe(0);
  });

  it('lista o histórico de interações em ordem cronológica reversa', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(token))
      .send({
        tipoPessoa: TipoPessoa.PJ,
        razaoSocial: 'Empresa Z',
        cidade: 'Gaspar',
        servicosInteresse: [],
        cnpjCpf: gerarCnpjValido('33444555'),
      });
    const clienteId = criado.body.id as string;

    await request(app)
      .post(`/api/clients/${clienteId}/interacoes`)
      .set(auth(token))
      .send({ tipo: 'LIGACAO', descricao: 'primeiro contato', data: '2026-01-01T10:00:00.000Z' });
    await request(app)
      .post(`/api/clients/${clienteId}/interacoes`)
      .set(auth(token))
      .send({ tipo: 'VISITA', descricao: 'visita presencial', data: '2026-02-01T10:00:00.000Z' });

    const lista = await request(app).get(`/api/clients/${clienteId}/interacoes`).set(auth(token));
    expect(lista.status).toBe(200);
    expect(lista.body.items).toHaveLength(2);
    expect(lista.body.items[0].descricao).toBe('visita presencial'); // mais recente primeiro
  });

  it('reenviar a mesma interação (mesmo id) depois de falha de rede não duplica', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(token))
      .send({
        tipoPessoa: TipoPessoa.PJ,
        razaoSocial: 'Empresa W',
        cidade: 'Gaspar',
        servicosInteresse: [],
        cnpjCpf: gerarCnpjValido('44555666'),
      });
    const clienteId = criado.body.id as string;
    const interacaoId = '33333333-3333-4333-8333-333333333333';
    const payload = { id: interacaoId, tipo: 'VISITA', descricao: 'visita de apresentação' };

    const primeiro = await request(app).post(`/api/clients/${clienteId}/interacoes`).set(auth(token)).send(payload);
    expect(primeiro.status).toBe(201);

    const reenvio = await request(app).post(`/api/clients/${clienteId}/interacoes`).set(auth(token)).send(payload);
    expect(reenvio.status).toBe(201);
    expect(reenvio.body.id).toBe(interacaoId);

    const total = await prisma.interacao.count({ where: { id: interacaoId } });
    expect(total).toBe(1);
  });
});
