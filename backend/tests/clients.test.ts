import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Perfil, TipoPessoa } from '@prisma/client';
import { createApp } from '../src/app';
import { isValidCnpj, isValidCpf } from '../src/lib/validators/cpfCnpj';
import { prisma, cleanDb } from './testUtils';

const app = createApp();

function gerarCnpjValido(baseParcial: string): string {
  const base = baseParcial.padEnd(12, '0').slice(0, 12); // CNPJ = 12 dígitos base + 2 verificadores
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
    data: {
      nome,
      email,
      senhaHash: await argon2.hash('SenhaForte123', { type: argon2.argon2id }),
      perfil,
    },
  });
}

async function tokenPara(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, senha: 'SenhaForte123' });
  return res.body.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const clienteBase = {
  tipoPessoa: TipoPessoa.PJ,
  razaoSocial: 'Empresa Teste Ltda',
  cidade: 'Gaspar',
  uf: 'SC',
  servicosInteresse: ['VIGILANCIA_PATRIMONIAL'],
};

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('validação de CNPJ/CPF (dígito verificador real)', () => {
  it('rejeita sequência de dígitos repetidos', () => {
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
  });

  it('rejeita CNPJ com dígito verificador errado', () => {
    const valido = gerarCnpjValido('11222333');
    const invalido = valido.slice(0, -1) + (Number(valido.at(-1)) === 9 ? '0' : '9');
    expect(isValidCnpj(invalido)).toBe(false);
  });

  it('aceita CNPJ com dígito verificador correto', () => {
    expect(isValidCnpj(gerarCnpjValido('11222333'))).toBe(true);
  });

  it('API rejeita criação de cliente com CNPJ inválido', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v1@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);

    const res = await request(app)
      .post('/api/clients')
      .set(auth(token))
      .send({ ...clienteBase, cnpjCpf: '12345678901234' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CNPJ inválido/);
  });
});

describe('anti-duplicidade', () => {
  it('bloqueia o mesmo CNPJ/CPF sendo cadastrado duas vezes, mesmo por vendedores diferentes', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    const cnpj = gerarCnpjValido('11222333');

    const primeiro = await request(app).post('/api/clients').set(auth(tokenA)).send({ ...clienteBase, cnpjCpf: cnpj });
    expect(primeiro.status).toBe(201);

    const segundoMesmoVendedor = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({ ...clienteBase, cnpjCpf: cnpj });
    expect(segundoMesmoVendedor.status).toBe(409);
    expect(segundoMesmoVendedor.body.error).toMatch(/Vendedor A/);

    const outroVendedor = await request(app)
      .post('/api/clients')
      .set(auth(tokenB))
      .send({ ...clienteBase, cnpjCpf: cnpj });
    expect(outroVendedor.status).toBe(409);
    expect(outroVendedor.body.error).toMatch(/Vendedor A/); // nome de quem cadastrou aparece...
    expect(outroVendedor.body.error).not.toMatch(/Empresa Teste Ltda/); // ...mas nenhum outro dado do lead
  });

  it('check-duplicate expõe só nome+data de quem cadastrou, nunca os dados do lead', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    const cnpj = gerarCnpjValido('22333444');
    await request(app).post('/api/clients').set(auth(tokenA)).send({ ...clienteBase, cnpjCpf: cnpj });

    const check = await request(app).get('/api/clients/check-duplicate').query({ cnpjCpf: cnpj }).set(auth(tokenB));

    expect(check.status).toBe(200);
    expect(check.body.exists).toBe(true);
    expect(check.body.cadastradoPorNome).toBe('Vendedor A');
    expect(Object.keys(check.body).sort()).toEqual(['cadastradoPorNome', 'dataCadastro', 'exists', 'message'].sort());
  });
});

describe('isolamento por vendedor', () => {
  it('vendedor B não vê, não edita e não encontra via API direta um cliente do vendedor A', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({ ...clienteBase, cnpjCpf: gerarCnpjValido('33444555') });
    const clienteId = criado.body.id as string;

    // não aparece na listagem do vendedor B
    const listaB = await request(app).get('/api/clients').set(auth(tokenB));
    expect(listaB.body.items.find((c: { id: string }) => c.id === clienteId)).toBeUndefined();

    // GET direto pelo id retorna 404 (não 403 — não revela que o registro existe)
    const getB = await request(app).get(`/api/clients/${clienteId}`).set(auth(tokenB));
    expect(getB.status).toBe(404);

    // PATCH direto também é bloqueado
    const patchB = await request(app)
      .patch(`/api/clients/${clienteId}`)
      .set(auth(tokenB))
      .send({ observacoes: 'tentando editar cliente alheio' });
    expect(patchB.status).toBe(404);

    // confirma no banco que nada mudou
    const noBanco = await prisma.cliente.findUnique({ where: { id: clienteId } });
    expect(noBanco?.observacoes).not.toBe('tentando editar cliente alheio');

    // o próprio vendedor A continua enxergando normalmente
    const getA = await request(app).get(`/api/clients/${clienteId}`).set(auth(tokenA));
    expect(getA.status).toBe(200);
  });

  it('supervisor e admin enxergam clientes de todos os vendedores', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const supervisor = await criarUsuario('Supervisora', 'sup@teste.com', Perfil.SUPERVISOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenSup = await tokenPara(supervisor.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({ ...clienteBase, cnpjCpf: gerarCnpjValido('44555666') });

    const getSup = await request(app).get(`/api/clients/${criado.body.id}`).set(auth(tokenSup));
    expect(getSup.status).toBe(200);

    const listaSup = await request(app).get('/api/clients').set(auth(tokenSup));
    expect(listaSup.body.items.some((c: { id: string }) => c.id === criado.body.id)).toBe(true);
  });

  it('só supervisor/admin podem reatribuir carteira — vendedor recebe 403', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const supervisor = await criarUsuario('Supervisora', 'sup@teste.com', Perfil.SUPERVISOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenSup = await tokenPara(supervisor.email);

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({ ...clienteBase, cnpjCpf: gerarCnpjValido('55666777') });

    const tentativaVendedor = await request(app)
      .patch(`/api/clients/${criado.body.id}/reassign`)
      .set(auth(tokenA))
      .send({ vendedorId: vendedorB.id });
    expect(tentativaVendedor.status).toBe(403);

    const reatribuicao = await request(app)
      .patch(`/api/clients/${criado.body.id}/reassign`)
      .set(auth(tokenSup))
      .send({ vendedorId: vendedorB.id });
    expect(reatribuicao.status).toBe(200);
    expect(reatribuicao.body.vendedorId).toBe(vendedorB.id);
  });
});

describe('idempotência de sincronização (fila offline)', () => {
  it('reenviar o mesmo cadastro com o mesmo id não duplica nem dá erro — devolve o registro existente', async () => {
    const vendedor = await criarUsuario('Vendedor', 'v@teste.com', Perfil.VENDEDOR);
    const token = await tokenPara(vendedor.email);
    const id = '11111111-1111-4111-8111-111111111111';
    const payload = { ...clienteBase, id, cnpjCpf: gerarCnpjValido('11222333') };

    const primeiro = await request(app).post('/api/clients').set(auth(token)).send(payload);
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.id).toBe(id);

    // simula o app reenviando depois de uma falha de rede (resposta perdida,
    // mas o registro já tinha sido criado no primeiro envio)
    const reenvio = await request(app).post('/api/clients').set(auth(token)).send(payload);
    expect(reenvio.status).toBe(201);
    expect(reenvio.body.id).toBe(id);

    const total = await prisma.cliente.count({ where: { id } });
    expect(total).toBe(1); // nunca duplicou
  });

  it('reenviar um id que já existe de outro vendedor é rejeitado, não devolvido como se fosse seu', async () => {
    const vendedorA = await criarUsuario('Vendedor A', 'a@teste.com', Perfil.VENDEDOR);
    const vendedorB = await criarUsuario('Vendedor B', 'b@teste.com', Perfil.VENDEDOR);
    const tokenA = await tokenPara(vendedorA.email);
    const tokenB = await tokenPara(vendedorB.email);
    const id = '22222222-2222-4222-8222-222222222222';

    const criado = await request(app)
      .post('/api/clients')
      .set(auth(tokenA))
      .send({ ...clienteBase, id, cnpjCpf: gerarCnpjValido('22333444') });
    expect(criado.status).toBe(201);

    const tentativaB = await request(app)
      .post('/api/clients')
      .set(auth(tokenB))
      .send({ ...clienteBase, id, cnpjCpf: gerarCnpjValido('33444555') });
    expect(tentativaB.status).toBe(409);
  });
});
