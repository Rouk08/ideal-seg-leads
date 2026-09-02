# Ideal Seg — CRM de Captação de Leads

App web (PWA) mobile-first para vendedores externos cadastrarem clientes
prospectados em campo, mesmo offline, com isolamento de dados por vendedor.

> **Status**: em construção, por etapas. Esta versão do README cobre o que já
> existe até agora: **schema do banco + auth + convites + CRUD de cliente +
> formulário mobile do vendedor + offline (IndexedDB + fila de
> sincronização)**. O dashboard de supervisor/admin é a próxima etapa.

## Stack

- Backend: Node + Express + TypeScript, PostgreSQL via Prisma, JWT (access
  curto + refresh token opaco rotativo em cookie httpOnly)
- Frontend: React + Vite + TypeScript, PWA (`vite-plugin-pwa`), mobile-first,
  React Router
- Sem Redis, sem fila externa — tudo roda em `docker compose` numa VPS simples

## Setup — backend

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

## Setup — frontend

### Desenvolvimento (hot-reload)

Rode o backend primeiro (seção acima), depois, **num terminal separado**:

```bash
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. O Vite já tem um proxy configurado
(`vite.config.ts`) mandando tudo que começa com `/api` pro backend em
`http://localhost:3333` — não precisa de nenhuma variável de ambiente pra
isso funcionar com a configuração padrão. Se o backend estiver em outro
endereço, exporte `VITE_API_PROXY_TARGET` antes de rodar `npm run dev`.

Login de teste (criado pelo seed): `vendedor@idealseg.com.br` / `TrocarSenha123!`.

### Produção (via Docker, junto com backend + Postgres)

```bash
docker compose up -d --build
```

Isso builda o frontend (Vite build estático) e serve via nginx na porta
`8080`, com um proxy interno de `/api/` pro serviço `backend` — front e API
ficam na **mesma origem** em produção, então o cookie httpOnly do refresh
token funciona sem nenhuma configuração extra de CORS. Acesse
`http://SEU_SERVIDOR:8080` (ou coloque atrás do Caddy/Nginx que já roda na
sua VPS, apontando pra essa porta).

### Rodando o frontend separado (build estático, sem o serviço `frontend` do compose)

Se preferir servir o build de outro jeito (outro Nginx, um CDN, etc.):

```bash
cd frontend
npm run build   # gera frontend/dist
```

Sirva `frontend/dist` como estático, com **duas exigências**:
1. Toda rota desconhecida deve cair em `index.html` (SPA — veja
   `try_files $uri /index.html;` em `frontend/nginx.conf` como referência).
2. Tudo que começa com `/api` precisa chegar ao backend (proxy reverso) — o
   frontend nunca aponta pra uma URL de API fixa, ele sempre chama `/api/...`
   relativo à própria origem.

### Testes

```bash
cd frontend
npm test
```

Cobrem a lógica da fila offline (`offline/syncQueue.ts`) contra um
IndexedDB de verdade — só que via `fake-indexeddb` (polyfill em Node, sem
precisar de um browser) em vez de um IndexedDB de browser real. A API é
mockada de propósito: o que esses testes garantem é a lógica da fila
(idempotência do lado do client, backoff, nunca descartar um item sozinho),
não uma chamada de rede — isso já é coberto pelos testes de integração do
backend (`backend/tests/`) e pela verificação manual ponta a ponta
(derrubar o container do backend de verdade e confirmar que o app continua
funcionando).

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
| GET | `/api/clients/:clienteId/interacoes` | autenticado, isolado | histórico de interações do cliente |
| POST | `/api/clients/:clienteId/interacoes` | autenticado, isolado | registra interação — **renova a reserva de carteira** |

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
- **Interações renovam a reserva de carteira**: `POST /clients/:id/interacoes`
  atualiza `reservadoAte` na mesma transação que cria a interação — é assim
  que a regra "sem interação no período, volta pro pool" é cumprida de
  verdade, sem depender de nenhuma lógica extra no formulário do vendedor.

## Decisões desta etapa (formulário mobile)

- **Access token só em memória** (`shared/api/client.ts`) — nunca em
  `localStorage`/`sessionStorage`. O refresh token (cookie httpOnly) é quem
  sobrevive ao reload; no boot da PWA, chamamos `/auth/refresh` pra
  reidratar a sessão numa tacada só (usuário + novo access token).
- **Rascunho automático em `localStorage`** (`NewClientWizard/draft.ts`) —
  salva a cada mudança (debounced) e é recuperado silenciosamente se o
  vendedor sair da tela no meio do preenchimento. Isto é só sobre não perder
  o que foi digitado; a fila de sincronização de cadastros pendentes de
  verdade (múltiplos, com retry, offline) é a próxima etapa.
- **O `id` do cliente é gerado no navegador** (`crypto.randomUUID()`) assim
  que o assistente abre, não quando o formulário é enviado — o mesmo `id`
  seria usado se o envio falhasse e precisasse ser reenviado depois (offline,
  próxima etapa), tornando o reenvio idempotente por construção.
- **Validação de CPF/CNPJ/telefone duplicada no frontend** — mesmo algoritmo
  do backend, para feedback instantâneo sem round-trip. O backend **sempre**
  revalida; o frontend é só UX, nunca a fonte da verdade.
- **Anti-duplicidade em tempo real**: assim que o CNPJ/CPF fica válido (dígito
  verificador OK), o wizard já consulta `check-duplicate` e bloqueia o
  "Avançar" se já existir — o vendedor nunca preenche o formulário
  inteiro pra só então descobrir que é duplicado.
- **Compressão de foto no aparelho** (`browser-image-compression`) antes do
  upload — importante em campo, onde a conexão costuma ser fraca; se a
  compressão falhar por algum motivo, envia o arquivo original (o backend
  ainda valida tamanho/formato).
- **Produção com front e API na mesma origem**: `frontend/nginx.conf` faz
  proxy de `/api/` pro serviço `backend` — evita configurar CORS em produção
  e garante que o cookie httpOnly do refresh token funciona sem fricção.

### Bugs reais encontrados testando o fluxo completo no navegador

- `GET /api/auth/login` e `/refresh` respondiam sem `metaMensal`/
  `percentualComissao` — só o `/auth/me` tinha sido atualizado pra incluir
  esses campos, e a Home (que precisa da meta do mês) usa o retorno do
  login/refresh, não uma chamada extra a `/me`. Corrigido com um helper
  único (`sanitizeUsuario`) reaproveitado nos três lugares.
- **`React.StrictMode` + rotação de refresh token**: o efeito de bootstrap
  da sessão roda duas vezes em desenvolvimento; como `/auth/refresh`
  rotaciona o token a cada uso, a 2ª chamada usava um cookie já revogado
  pela 1ª e derrubava a sessão que tinha acabado de funcionar. A correção
  óbvia (uma ref pra só disparar a requisição uma vez) quebrou de outro
  jeito: o cleanup sintético do StrictMode entre as duas invocações marcava
  a ÚNICA requisição real como "cancelada" antes dela responder, travando a
  tela em "Carregando…" pra sempre. Resolvido removendo o padrão de
  cancelamento por cleanup neste efeito específico — o `AuthProvider` vive
  uma vez só pra vida toda do app, então o cenário que esse padrão
  normalmente evita (setState após desmontagem de verdade) não se aplica
  aqui.

## Decisões desta etapa (offline — IndexedDB + fila de sincronização)

- **Idempotência de verdade, não só client-side**: o `id` gerado no
  aparelho (já existia desde a etapa do formulário) agora é reconhecido
  pelo **backend** como chave de idempotência — `POST /clients` e
  `POST /clients/:id/interacoes` com um `id` que já existe (do mesmo
  vendedor) devolvem o registro existente em vez de tentar criar de novo ou
  barrar como duplicata. Sem isso, reenviar depois de uma falha de rede
  "resposta perdida, mas o registro já tinha ido pro banco" duplicaria ou
  daria erro — o backend nunca confia só no frontend não reenviar duas
  vezes.
- **Fila em IndexedDB** (`offline/db.ts`, via `idb`), uma store só
  (`filaSync`) com um campo `tipo` discriminando cliente/interação — os
  dois seguem o mesmo ciclo de vida (tenta online, guarda na fila só se
  falhar por rede, reenvia com backoff). A foto da fachada (Blob) vai
  guardada junto no mesmo item, já comprimida — IndexedDB aceita Blob
  nativamente, ao contrário de localStorage.
- **`enqueue` não tenta enviar sozinho** — só grava e notifica. Quem
  dispara uma tentativa de verdade é o timer periódico (20s), o evento
  `online` do browser, ou o botão "Tentar agora". Evita uma corrida entre
  quem chamou `enqueue` (que acabou de levar uma falha) e uma tentativa
  imediata que tem baixíssima chance de dar certo.
- **Backoff exponencial por item** (5s → dobra a cada falha → teto de 5min),
  guardado em `proximaTentativaEm` no próprio registro — sobrevive a reload
  da página, não é só um `setTimeout` em memória.
- **Nunca descarta um item sozinho.** Um erro de validação real (4xx) fica
  visível na fila com a mensagem do servidor, mas continua lá — perder o
  cadastro que o vendedor digitou em campo não é uma opção, mesmo que o
  dado precise de correção manual depois.
- **Indicador visual** (`SyncBanner`, "X cadastros pendentes") na Home e em
  Meus Clientes; a tela de Detalhe mostra o mesmo estado só pra interações
  daquele cliente específico.

### Bugs reais encontrados testando offline de propósito (matando o backend, não simulando)

- **Abrir o app sem conexão chutava pro login**, mesmo pra quem já estava
  logado — o bootstrap de sessão (`/auth/refresh`) falhava por falta de
  rede e isso derrubava a sessão inteira, quebrando a regra "o cadastro
  completo funciona sem rede" logo na porta de entrada. Corrigido com um
  cache local só do *perfil* do usuário (nunca token) — se o bootstrap
  falha por rede e existe uma sessão conhecida em cache, o app libera o
  acesso mesmo sem access token válido (`sessaoDegradada`); qualquer
  chamada de API de verdade ainda vai falhar/enfileirar normalmente até a
  conexão voltar.
- **Matar o backend não produz uma falha de rede "crua"** — o proxy no meio
  do caminho (Vite em dev, nginx em produção) responde com um 500/502/503
  de verdade. Se só uma falha de `fetch()` genuína entrasse na fila
  offline, qualquer instabilidade de backend/proxy (bem mais comum em
  campo do que ficar 100% sem sinal) mostraria um erro de "dado inválido"
  pro vendedor em vez de guardar o cadastro. Corrigido com
  `isFalhaTransitoria()` — um helper único, usado em todo lugar que decide
  "isso é offline ou é erro de verdade" (o formulário, a nova interação, e
  o próprio bootstrap de sessão), tratando qualquer 5xx como transitório e
  só 4xx como erro real. Esse mesmo bug apareceu de novo no bootstrap de
  sessão depois de já ter sido corrigido no formulário — cada ponto de
  decisão homogêneo precisou do mesmo tratamento.
- **`vi.useFakeTimers()` trava os testes quando usado com `fake-indexeddb`**
  — o polyfill depende de `setTimeout`/microtasks reais pra resolver
  transações por baixo dos panos; fakear o relógio inteiro (em vez de só
  `Date.now`) deixa essas transações penduradas pra sempre. Trocado por
  `vi.spyOn(Date, 'now')`, que não toca nos timers.

## Próximas etapas (ordem combinada)

1. ~~Auth e convites~~ ✅
2. ~~Migration inicial gerada + revisão do schema aplicado~~ ✅
3. ~~CRUD de cliente com anti-duplicidade e isolamento por vendedor~~ ✅
4. ~~Formulário mobile em etapas~~ ✅
5. ~~Offline (IndexedDB + fila de sincronização)~~ ✅
6. Dashboard supervisor/admin
