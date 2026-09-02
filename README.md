# Ideal Seg — CRM de Captação de Leads

App web (PWA) mobile-first para vendedores externos cadastrarem clientes
prospectados em campo, mesmo offline, com isolamento de dados por vendedor.

> **Status**: em construção, por etapas. Esta versão do README cobre o que já
> existe até agora: **schema do banco + auth + convites**. As demais seções
> (CRUD de cliente, formulário mobile, offline, dashboard) serão preenchidas
> conforme as próximas etapas forem implementadas.

## Stack

- Backend: Node + Express + TypeScript, PostgreSQL via Prisma, JWT (access
  curto + refresh token opaco rotativo em cookie httpOnly)
- Frontend (a partir da próxima etapa): React + Vite, PWA, offline-first com
  IndexedDB
- Sem Redis, sem fila externa — tudo roda em `docker compose` numa VPS simples

## Setup — backend (etapa atual)

### 1. Variáveis de ambiente

Na raiz do projeto:

```bash
cp .env.example .env
```

Edite `.env` e troque pelo menos:
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` (gere com `openssl rand -base64 48`)
- `SEED_ADMIN_SENHA` (senha do usuário admin de bootstrap)

### 2. Subir o Postgres (via Docker)

```bash
docker compose up -d postgres
```

### 3. Rodar o backend localmente (fora do Docker, para desenvolver)

```bash
cd backend
npm install
cp ../.env .env   # ou copie manualmente as mesmas variáveis pra backend/.env
npm run prisma:migrate    # cria as tabelas (pede um nome pra migration na 1ª vez)
npm run prisma:seed       # cria o usuário ADMIN de bootstrap
npm run dev                # sobe em http://localhost:3333
```

O `prisma:seed` imprime no terminal o e-mail/senha do admin criado — troque a
senha assim que fizer o primeiro login (a troca de senha pelo próprio usuário
ainda não tem tela nesta etapa; por ora, gere um novo hash e atualize direto
no banco, ou aguarde a tela de gestão de usuários).

### 4. Rodar tudo via Docker (backend + Postgres)

```bash
docker compose up -d --build
docker compose exec backend npm run prisma:seed
```

O backend expõe `http://localhost:3333`. `docker compose up` já roda as
migrations automaticamente antes de iniciar (`prisma migrate deploy`, ver
`backend/Dockerfile`).

### 5. Testes

Os testes de auth/convites sobem contra um Postgres real (não usam mock), e
fazem `TRUNCATE` nas tabelas a cada teste — por isso usam um **banco separado
do de desenvolvimento** (`ideal_seg_leads_test`), nunca o mesmo `DATABASE_URL`
do `.env` principal:

```bash
# cria o banco de teste (uma vez só)
docker compose exec postgres psql -U idealseg -d postgres -c "CREATE DATABASE ideal_seg_leads_test OWNER idealseg;"

cd backend
cp .env.test.example .env.test    # ajuste a senha do Postgres se você trocou a padrão
DATABASE_URL="postgresql://idealseg:SUA_SENHA@localhost:5432/ideal_seg_leads_test" npx prisma migrate deploy

npm test
```

`vitest` carrega `backend/.env.test` automaticamente (via `tests/env.setup.ts`)
antes de qualquer teste rodar. Se esse arquivo não existir, os testes avisam
no terminal e caem no `.env` normal — o que apagaria dados do seu banco de
desenvolvimento, então não pule esse passo.

## Fluxo de convite (sem auto-cadastro)

1. ADMIN loga e chama `POST /api/invites` com `{ email, nome?, perfil }`.
   A resposta traz `link` — a URL que deve ser enviada ao vendedor (por
   enquanto manualmente; e-mail transacional fica pra depois).
2. O vendedor abre o link, o frontend chama `GET /api/invites/validate?token=...`
   pra confirmar que o convite é válido e pré-preencher e-mail/nome.
3. O vendedor define a senha em `POST /api/invites/accept` — isso cria o
   usuário já `ativo` e marca o convite como `USADO` (token de uso único,
   nunca reaproveitável, e expira em `INVITE_EXPIRES_IN_HOURS`, 72h por
   padrão).

## Rotas implementadas até agora

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público (rate-limited) | login, retorna access token + seta cookie de refresh |
| POST | `/api/auth/refresh` | cookie de refresh | rotaciona o refresh token, emite novo access token |
| POST | `/api/auth/logout` | cookie de refresh | revoga o refresh token atual |
| GET | `/api/auth/me` | autenticado | dados do usuário logado |
| POST | `/api/invites` | ADMIN | gera convite |
| GET | `/api/invites` | ADMIN | lista convites |
| DELETE | `/api/invites/:id` | ADMIN | revoga convite pendente |
| GET | `/api/invites/validate?token=` | público | valida token sem consumir |
| POST | `/api/invites/accept` | público | consome o token e cria o usuário |

## Decisões de segurança desta etapa

- Senha com **argon2id**.
- Refresh token **opaco** (não é JWT) guardado com **hash SHA-256** no banco
  — só o valor cru sai no cookie `httpOnly`; um vazamento do banco não permite
  reconstruir sessões válidas.
- **Rotação de refresh token** a cada uso: o token antigo é revogado e um novo
  é emitido. Reapresentar um token já rotacionado falha (sinal de possível
  roubo de token).
- Convite: mesmo princípio do refresh token — só o hash do token fica no
  banco. A troca de status `PENDENTE -> USADO` acontece como parte da
  condição do `UPDATE`, então dois aceites simultâneos do mesmo convite nunca
  criam dois usuários.
- Login não distingue "e-mail não existe" de "senha errada" na mensagem de
  erro, e tem rate limit por IP.

## Próximas etapas (ordem combinada)

1. ~~Auth e convites~~ ✅
2. Migration inicial gerada + revisão do schema aplicado
3. CRUD de cliente com anti-duplicidade e isolamento por vendedor
4. Formulário mobile em etapas
5. Offline (IndexedDB + fila de sincronização)
6. Dashboard supervisor/admin
