# Ideal Seg — CRM de Captação de Leads

App web (PWA) mobile-first para vendedores externos cadastrarem clientes
prospectados em campo, mesmo offline, com isolamento de dados por vendedor.

> **Status**: em construção, por etapas. Esta versão do README cobre o que já
> existe até agora: **schema do banco + auth + convites + CRUD de cliente**.
> As demais seções (formulário mobile, offline, dashboard) serão preenchidas
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

O `prisma:seed` cria 3 usuários (um de cada perfil) e 10 clientes fictícios
de Gaspar/Blumenau, e imprime as credenciais no terminal — troque as senhas
assim que fizer o primeiro login (a troca de senha pelo próprio usuário ainda
não tem tela nesta etapa; por ora, gere um novo hash e atualize direto no
banco, ou aguarde a tela de gestão de usuários).

| Perfil | E-mail | Senha (padrão do seed) |
|---|---|---|
| ADMIN | `admin@idealseg.com.br` | `TrocarSenha123!` |
| SUPERVISOR | `supervisor@idealseg.com.br` | `TrocarSenha123!` |
| VENDEDOR | `vendedor@idealseg.com.br` | `TrocarSenha123!` |

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
| GET | `/api/clients/check-duplicate?cnpjCpf=` | autenticado | pré-checagem de duplicidade (só nome+data de quem cadastrou) |
| POST | `/api/clients` | autenticado | cria cliente (vendedorId sempre = quem está logado) |
| GET | `/api/clients` | autenticado | lista (isolada por vendedor; supervisor/admin veem tudo) — filtros: `etapaFunil`, `cidade`, `servico`, `vendedorId`, `busca`, `page`, `pageSize` |
| GET | `/api/clients/:id` | autenticado, isolado | detalhe — 404 (não 403) se não pertence ao vendedor |
| PATCH | `/api/clients/:id` | autenticado, isolado | edita (não permite trocar `cnpjCpf`) |
| PATCH | `/api/clients/:id/reassign` | SUPERVISOR/ADMIN | reatribui a carteira, renova a reserva |
| POST | `/api/clients/:id/foto` | autenticado, isolado | upload da foto da fachada (multipart, campo `foto`) |
| GET | `/api/clients/:id/foto` | autenticado, isolado | stream da foto |
| GET | `/api/external/cnpj/:cnpj` | autenticado | proxy BrasilAPI — preenchimento automático |
| GET | `/api/external/cep/:cep` | autenticado | proxy BrasilAPI — preenchimento automático |

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

## Decisões desta etapa (CRUD de cliente)

- **Isolamento por vendedor concentrado num único lugar**: toda query de
  `Cliente` passa por `clients.repository.ts`, que aplica o filtro
  `vendedorId` automaticamente pra quem é `VENDEDOR` (supervisor/admin
  enxergam tudo). Nenhum outro módulo consulta `prisma.cliente` diretamente
  — é assim que se garante que uma rota nova, um relatório ou uma exportação
  futura não acabam vazando dado de um vendedor pro outro "por esquecimento".
- Cliente inacessível (não existe OU é de outro vendedor) sempre responde
  **404**, nunca 403 — um 403 diferenciado revelaria que aquele CNPJ/CPF
  pertence a alguém, mesmo sem mostrar os dados.
- **Anti-duplicidade** é uma constraint `UNIQUE` no banco (`cnpjCpf`), com uma
  checagem amigável antes (`check-duplicate`) que devolve só
  `{ exists, cadastradoPorNome, dataCadastro }` — testado explicitamente pra
  garantir que nenhum outro campo do lead alheio vaza nessa resposta.
- **CPF/CNPJ**: validação real de dígito verificador (`lib/validators/cpfCnpj.ts`),
  não só formato/tamanho.
- **BrasilAPI**: proxy no backend (não direto do frontend) — evita CORS e
  centraliza o tratamento de erro. Timeout de 5s e qualquer falha (rede, API
  fora do ar, CNPJ/CEP não encontrado) vira **404 limpo**, nunca um 500 nem
  trava a resposta — o formulário (próxima etapa) cai pro preenchimento
  manual nesse caso. *Achado ao testar de verdade*: a BrasilAPI bloqueia
  (403) requisições sem `User-Agent`, que é o que o `fetch` nativo do Node
  manda por padrão — corrigido enviando um `User-Agent` fixo.
- **Reserva de carteira**: `reservadoAte` é setado em `agora + diasReservaCarteira`
  (parâmetro em `Settings`, 60 dias por padrão) na criação e na reatribuição.
  Um job diário (`jobs/releaseExpiredReservations.ts`, node-cron, 03:00 +
  uma vez na subida) limpa `reservadoAte` de reservas vencidas — isso **não**
  tira o cliente do vendedor original, só sinaliza que a exclusividade
  expirou; só supervisor/admin reatribuem de fato.
- **Upload de foto**: recebido em memória (multer) e salvo via
  `lib/storage.ts` — trocar de disco local pra S3 depois é reescrever só essa
  classe. Servido por uma rota autenticada (`GET /clients/:id/foto`) que
  reaplica o mesmo isolamento por vendedor, em vez de um `express.static`
  público — senão bastaria adivinhar o caminho do arquivo pra furar o
  isolamento.

## Próximas etapas (ordem combinada)

1. ~~Auth e convites~~ ✅
2. ~~Migration inicial gerada + revisão do schema aplicado~~ ✅
3. ~~CRUD de cliente com anti-duplicidade e isolamento por vendedor~~ ✅
4. Formulário mobile em etapas
5. Offline (IndexedDB + fila de sincronização)
6. Dashboard supervisor/admin
