import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { Perfil } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma, cleanDb } from './testUtils';

const app = createApp();

async function criarAdmin() {
  return prisma.usuario.create({
    data: {
      nome: 'Admin Teste',
      email: 'admin@teste.com',
      senhaHash: await argon2.hash('SenhaForte123', { type: argon2.argon2id }),
      perfil: Perfil.ADMIN,
    },
  });
}

async function criarVendedor() {
  return prisma.usuario.create({
    data: {
      nome: 'Vendedor Teste',
      email: 'vendedor@teste.com',
      senhaHash: await argon2.hash('SenhaForte123', { type: argon2.argon2id }),
      perfil: Perfil.VENDEDOR,
    },
  });
}

async function loginComo(email: string, senha = 'SenhaForte123') {
  const res = await request(app).post('/api/auth/login').send({ email, senha });
  return res;
}

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth', () => {
  it('login com credenciais corretas retorna access token e seta cookie de refresh', async () => {
    await criarAdmin();
    const res = await loginComo('admin@teste.com');

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.usuario.perfil).toBe('ADMIN');
    expect(res.headers['set-cookie']?.[0]).toMatch(/refresh_token=/);
  });

  it('login com senha errada retorna 401 com mensagem genérica', async () => {
    await criarAdmin();
    const res = await loginComo('admin@teste.com', 'senhaErrada');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('E-mail ou senha inválidos');
  });

  it('login de usuário inativo é bloqueado', async () => {
    const admin = await criarAdmin();
    await prisma.usuario.update({ where: { id: admin.id }, data: { ativo: false } });
    const res = await loginComo('admin@teste.com');
    expect(res.status).toBe(401);
  });

  it('refresh token é rotacionado e o token antigo não pode ser reutilizado', async () => {
    await criarAdmin();
    const loginRes = await loginComo('admin@teste.com');
    const cookie = loginRes.headers['set-cookie'][0];

    const refreshRes1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes1.status).toBe(200);

    // reapresentando o cookie de refresh já usado/rotacionado deve falhar
    const refreshRes2 = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshRes2.status).toBe(401);
  });
});

describe('convites', () => {
  it('apenas ADMIN pode criar convite', async () => {
    const vendedor = await criarVendedor();
    const loginRes = await loginComo('vendedor@teste.com');

    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ email: 'novo@teste.com', perfil: 'VENDEDOR' });

    expect(res.status).toBe(403);
    void vendedor;
  });

  it('fluxo completo: admin convida, convidado valida token e aceita, vira usuário ativo', async () => {
    await criarAdmin();
    const loginRes = await loginComo('admin@teste.com');
    const accessToken = loginRes.body.accessToken;

    const createRes = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'vendedor.novo@teste.com', nome: 'Vendedor Novo', perfil: 'VENDEDOR' });

    expect(createRes.status).toBe(201);
    const token = new URL(createRes.body.link).searchParams.get('token')!;
    expect(token).toBeTruthy();

    const validateRes = await request(app).get('/api/invites/validate').query({ token });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.email).toBe('vendedor.novo@teste.com');

    const acceptRes = await request(app).post('/api/invites/accept').send({
      token,
      nome: 'Vendedor Novo',
      senha: 'MinhaSenha123',
      confirmarSenha: 'MinhaSenha123',
    });

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.usuario.perfil).toBe('VENDEDOR');

    const novoLogin = await loginComo('vendedor.novo@teste.com', 'MinhaSenha123');
    expect(novoLogin.status).toBe(200);
  });

  it('convite não pode ser aceito duas vezes', async () => {
    await criarAdmin();
    const loginRes = await loginComo('admin@teste.com');

    const createRes = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ email: 'unico@teste.com', perfil: 'VENDEDOR' });

    const token = new URL(createRes.body.link).searchParams.get('token')!;
    const payload = { token, nome: 'Único', senha: 'MinhaSenha123', confirmarSenha: 'MinhaSenha123' };

    const primeiro = await request(app).post('/api/invites/accept').send(payload);
    expect(primeiro.status).toBe(201);

    const segundo = await request(app).post('/api/invites/accept').send(payload);
    expect(segundo.status).toBe(410);
  });

  it('convite expirado não pode ser aceito', async () => {
    await criarAdmin();
    const loginRes = await loginComo('admin@teste.com');

    const createRes = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ email: 'expirado@teste.com', perfil: 'VENDEDOR' });

    const token = new URL(createRes.body.link).searchParams.get('token')!;

    // força a expiração diretamente no banco, sem esperar o prazo real
    await prisma.invite.updateMany({
      where: { email: 'expirado@teste.com' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app).post('/api/invites/accept').send({
      token,
      nome: 'Expirado',
      senha: 'MinhaSenha123',
      confirmarSenha: 'MinhaSenha123',
    });

    expect(res.status).toBe(410);
  });
});
