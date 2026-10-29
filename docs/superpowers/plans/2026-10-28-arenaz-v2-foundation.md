# ArenaZ v2 — Fundação (Plano 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o front v1 por um monorepo com API própria, banco, autenticação e um web mínimo onde a pessoa cria conta, entra e vê a própria conta — com CI verde.

**Architecture:** pnpm + Turborepo. `apps/api` (NestJS sobre Fastify) expõe `/api/*`, autentica com Better Auth (sessão em cookie httpOnly, tabelas no Postgres via Drizzle). `apps/web` (Next.js) faz proxy de `/api/*` para a API via `rewrites`, então navegador e API ficam na mesma origem (sem CORS, cookie `SameSite=Lax`). Schemas zod em `packages/contracts` são a única definição de payloads, usados pela API e pelos formulários.

**Tech Stack:** Node LTS, pnpm, Turborepo, TypeScript strict, NestJS + @nestjs/platform-fastify, Better Auth, Drizzle ORM + drizzle-kit, PostgreSQL + PostGIS, Redis, zod, Next.js (App Router), Tailwind CSS v4, react-hook-form, Vitest (+ unplugin-swc na API), Testcontainers, Playwright, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md`

## Global Constraints

- Node.js Active LTS ≥ 24 (`.nvmrc`), pnpm ≥ 10 (`packageManager` no `package.json` raiz).
- Next.js ≥ 16, React ≥ 19.2, Tailwind ≥ 4.1, NestJS ≥ 11, TypeScript ≥ 5.9, PostgreSQL ≥ 17 + PostGIS ≥ 3.5.
- Versões: última estável na hora de instalar (`pnpm view <pkg> version`); nunca `latest`/`*`.
- `strict: true` em todo `tsconfig`; proibido `ignoreBuildErrors`/`ignoreDuringBuilds`.
- Textos de interface e mensagens de erro em pt-BR; código em inglês.
- Dinheiro em centavos inteiros (`*_cents`); datas `timestamptz` UTC.
- Senha: ≥ 8 caracteres, com maiúscula, minúscula, número e caractere especial.
- E-mail: `trim` + minúsculas antes de salvar ou comparar.
- Erros HTTP da API no formato `application/problem+json`: `{ type, title, status, detail?, errors? }`.
- GitHub Actions: `permissions: contents: read`, actions fixadas por SHA de commit, sem secrets.
- Visual: tokens, fontes e logo de `docs/design/prototipo-v2.md` (protótipo aprovado); logo atual, sem logo novo.
- Trabalhar no branch `feat/v2-foundation`; abrir PR para `main` no fim (o repositório é do Luiz — não dar push direto em `main`).

## Review Focus

1. **E-mail com maiúscula/espaço** (`" Joao@Mail.com "` no cadastro, `joao@mail.com` no login) → login funciona. Teste na Task 5.
2. **Cadastro com e-mail já usado** → 422 com mensagem em pt-BR, não 500 nem vazamento de stack. Teste na Task 5.
3. **Banco fora do ar** → `GET /api/health` responde 503 `{ status: "degraded", db: "down" }` em vez de travar ou 500. Teste na Task 4.
4. **Variável de ambiente faltando/inválida** → API não sobe e a mensagem lista o nome da variável. Teste na Task 4.
5. **Sessão expirada ou cookie adulterado** em `/conta` → redireciona para `/entrar?next=/conta`, sem tela de erro. Teste na Task 6 (unit) e Task 7 (e2e).

---

## Mapa de arquivos

```
.nvmrc  package.json  pnpm-workspace.yaml  turbo.json  .gitignore  .editorconfig  .prettierrc
infra/docker-compose.yml  .env.example
docs/legacy/app-functionalities.md                 (movido de documents/)
packages/config/        tsconfig.base.json, tsconfig.next.json, eslint.config.js
packages/contracts/src/ common.ts, auth.ts, health.ts, problem.ts, index.ts (+ *.test.ts)
packages/db/src/        client.ts, schema/auth.ts, schema/index.ts, index.ts
packages/db/            drizzle.config.ts, migrations/0000_extensions.sql, test/global-setup.ts
apps/api/src/           main.ts, app.factory.ts, app.module.ts
apps/api/src/config/    env.ts
apps/api/src/common/    problem.filter.ts, zod.pipe.ts
apps/api/src/health/    health.controller.ts, health.module.ts
apps/api/src/auth/      auth.ts, auth.routes.ts, auth.guard.ts, current-user.decorator.ts, me.controller.ts, auth.module.ts
apps/api/test/          health.e2e.test.ts, env.test.ts, auth.e2e.test.ts, problem.e2e.test.ts
apps/web/               next.config.ts, src/app/{layout,page}.tsx, src/app/(auth)/{entrar,cadastro}/page.tsx,
                        src/app/conta/page.tsx, src/lib/{auth-client,session}.ts, src/components/auth/*
apps/web/e2e/           auth.spec.ts, playwright.config.ts
.github/workflows/ci.yml
```

---

### Task 1: Arquivar o v1 e criar o esqueleto do monorepo

**Files:**
- Delete: `src/`, `public/`, `data/`, `package.json`, `yarn.lock`, `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `eslint.config.mjs`
- Move: `documents/app-functionalities.md` → `docs/legacy/app-functionalities.md`, `documents/changelog.md` → `docs/legacy/changelog.md`
- Create: `.nvmrc`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `packages/config/{package.json,tsconfig.base.json,tsconfig.next.json,eslint.config.js}`
- Modify: `.gitignore` (adicionar `node_modules`, `.turbo`, `dist`, `.next`, `.env`, `coverage`, `playwright-report`, `test-results`), `README.md`

**Interfaces:**
- Produces: pacote `@arenaz/config` com `tsconfig.base.json` (strict, `module`/`moduleResolution: NodeNext`, `target: ES2023`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), `tsconfig.next.json` (estende base, `moduleResolution: Bundler`, `jsx: preserve`), e `eslint.config.js` exportando um array flat config (typescript-eslint `strictTypeChecked` + `eslint-config-prettier`). Scripts raiz que todo pacote implementa: `build`, `dev`, `lint`, `typecheck`, `test`.

- [ ] **Step 1: Criar branch e tag do legado**

```bash
git switch -c feat/v2-foundation
git tag legacy-v1 main
```

- [ ] **Step 2: Remover o v1 e mover docs** (lista em *Files*). Reescrever `README.md`: uma linha sobre o produto, pré-requisitos (Node LTS, pnpm, Docker), `pnpm i`, `pnpm db:up`, `pnpm dev`, e "o v1 está na tag `legacy-v1`".

- [ ] **Step 3: Raiz do workspace.** `pnpm-workspace.yaml` com `apps/*` e `packages/*`. `turbo.json` com tasks `build` (`dependsOn: ["^build"]`, outputs `dist/**`, `.next/**` exceto `.next/cache/**`), `typecheck` e `lint` (`dependsOn: ["^build"]`), `test` (`dependsOn: ["^build"]`, `env: ["DATABASE_URL"]`), `dev` (`persistent`, sem cache). `package.json` raiz: `private`, `packageManager: "pnpm@<versão>"`, `engines.node: ">=24"`, scripts `dev|build|lint|typecheck|test` → `turbo run <x>`, `db:up` → `docker compose -f infra/docker-compose.yml up -d`, `format` → `prettier --write .`.

- [ ] **Step 4: `packages/config`** conforme *Interfaces*.

- [ ] **Step 5: Verificar**

Run: `pnpm install && pnpm turbo run typecheck lint`
Expected: termina com exit 0 ("0 tasks" é aceitável neste ponto — ainda não há pacotes com código).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: archive v1 and scaffold pnpm/turbo monorepo"
```

---

### Task 2: `packages/contracts` — schemas compartilhados

**Files:**
- Create: `packages/contracts/{package.json,tsconfig.json,vitest.config.ts}`, `packages/contracts/src/{common,auth,health,problem,index}.ts`
- Test: `packages/contracts/src/auth.test.ts`, `packages/contracts/src/common.test.ts`

**Interfaces:**
- Produces (todos exportados de `@arenaz/contracts`):
  - `emailSchema: z.ZodType<string>` — `trim().toLowerCase()` e formato de e-mail; mensagem `"E-mail inválido"`.
  - `passwordSchema` — regras da *Global Constraints*; mensagem `"A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial"`.
  - `phoneBrSchema` — aceita `(11) 98765-4321`, `11987654321`, `+5511987654321`; produz E.164 `+5511987654321`; mensagem `"Telefone inválido"`.
  - `signUpSchema = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema })`; `type SignUpInput`.
  - `signInSchema = z.object({ email: emailSchema, password: z.string().min(1) })`; `type SignInInput`.
  - `meResponseSchema = z.object({ id: z.string(), name: z.string(), email: z.string(), createdAt: z.string() })`; `type MeResponse`.
  - `healthResponseSchema = z.object({ status: z.enum(["ok","degraded"]), db: z.enum(["up","down"]) })`; `type HealthResponse`.
  - `type Problem = { type: string; title: string; status: number; detail?: string; errors?: Record<string, string[]> }`.
  - `centsSchema = z.number().int().nonnegative()`.
- Pacote compila para `dist/` (ESM + `.d.ts`) com `tsc`; `exports` aponta para `dist`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// auth.test.ts
it("normaliza e-mail", () => {
  expect(signUpSchema.parse({ name: "Joao", email: "  Joao@Mail.COM ", password: "Senha@123" }).email)
    .toBe("joao@mail.com");
});
it.each(["curta1!", "semmaiuscula1!", "SEMMINUSCULA1!", "SemNumero!", "SemEspecial1"])(
  "rejeita senha fraca %s", (password) => {
    expect(signUpSchema.safeParse({ name: "Joao", email: "j@m.com", password }).success).toBe(false);
  });
it("aceita senha forte", () => {
  expect(passwordSchema.safeParse("Senha@123").success).toBe(true);
});
it("rejeita nome com 1 caractere após trim", () => {
  expect(signUpSchema.safeParse({ name: " J ", email: "j@m.com", password: "Senha@123" }).success).toBe(false);
});
// common.test.ts
it.each(["(11) 98765-4321", "11987654321", "+5511987654321"])("normaliza telefone %s", (raw) => {
  expect(phoneBrSchema.parse(raw)).toBe("+5511987654321");
});
it.each(["1234", "(11) 8765-432", "+1 415 555 0100"])("rejeita telefone %s", (raw) => {
  expect(phoneBrSchema.safeParse(raw).success).toBe(false);
});
it("rejeita centavos fracionados e negativos", () => {
  expect(centsSchema.safeParse(10.5).success).toBe(false);
  expect(centsSchema.safeParse(-1).success).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @arenaz/contracts test`
Expected: FAIL — módulos/exports inexistentes.

- [ ] **Step 3: Implementar os schemas** em `common.ts` (email, phone, cents), `auth.ts`, `health.ts`, `problem.ts`, reexportar em `index.ts`. Telefone: remover não-dígitos, aceitar 10–11 dígitos (DDD + número) com ou sem prefixo `55`, prefixar `+55`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @arenaz/contracts test && pnpm --filter @arenaz/contracts build`
Expected: PASS; `dist/index.d.ts` existe.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): shared zod schemas for auth, health and errors"
```

---

### Task 3: Infra local e `packages/db`

**Files:**
- Create: `infra/docker-compose.yml`, `.env.example`, `packages/db/{package.json,tsconfig.json,drizzle.config.ts,vitest.config.ts}`, `packages/db/src/{client,index}.ts`, `packages/db/src/schema/{auth,index}.ts`, `packages/db/migrations/0000_extensions.sql`, `packages/db/test/global-setup.ts`
- Test: `packages/db/test/migrations.test.ts`

**Interfaces:**
- Produces:
  - `type Db = NodePgDatabase<typeof schema>` e `createDb(url: string): { db: Db; pool: pg.Pool }` em `@arenaz/db`.
  - `schema` (namespace) com as tabelas do Better Auth: `user`, `session`, `account`, `verification`.
  - `runMigrations(url: string): Promise<void>` (usa `drizzle-orm/node-postgres/migrator`, pasta `migrations`).
  - `@arenaz/db/test-setup` → Vitest `globalSetup` que sobe `PostgreSqlContainer("postgis/postgis:17-3.5")`, roda `runMigrations` e exporta `DATABASE_URL` via `provide`/`process.env`. Usado também pela API (Task 4+).
- `docker-compose.yml`: serviço `postgres` (`postgis/postgis:17-3.5`, porta 5432, volume nomeado, healthcheck `pg_isready`), serviço `redis` (`redis:7-alpine`, porta 6379). Redis ainda não é usado pela API neste plano; sobe agora para o ambiente local ficar completo.
- `.env.example`: `DATABASE_URL=postgres://arenaz:arenaz@localhost:5432/arenaz`, `REDIS_URL=redis://localhost:6379`, `BETTER_AUTH_SECRET=` (instrução: `openssl rand -base64 32`), `BETTER_AUTH_URL=http://localhost:3000`, `API_PORT=4000`, `API_URL=http://localhost:4000`, `WEB_ORIGIN=http://localhost:3000`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it("instala postgis e btree_gist", async () => {
  const { rows } = await pool.query("select extname from pg_extension");
  expect(rows.map((r) => r.extname)).toEqual(expect.arrayContaining(["postgis", "btree_gist"]));
});
it("cria tabelas de auth", async () => {
  const { rows } = await pool.query("select table_name from information_schema.tables where table_schema='public'");
  expect(rows.map((r) => r.table_name)).toEqual(expect.arrayContaining(["user", "session", "account", "verification"]));
});
it("e-mail de usuário é único", async () => { /* dois inserts com o mesmo email → segundo rejeita com code 23505 */ });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @arenaz/db test` (Docker precisa estar rodando)
Expected: FAIL — migrations inexistentes.

- [ ] **Step 3: Implementar.** `0000_extensions.sql` é uma migration customizada (`drizzle-kit generate --custom --name extensions`) com `CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS btree_gist;`. Gerar `schema/auth.ts` com `npx @better-auth/cli generate` apontando para a config da Task 5 — ou, se a Task 5 ainda não existir, escrever as 4 tabelas conforme a documentação do adapter Drizzle do Better Auth (mesmos nomes de coluna) — e então `drizzle-kit generate` para a migration `0001`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @arenaz/db test`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add infra .env.example packages/db
git commit -m "feat(db): docker compose, drizzle client, extensions and auth tables"
```

---

### Task 4: `apps/api` — bootstrap, config, erros e health

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,vitest.config.ts,nest-cli.json}`, `apps/api/src/{main,app.factory,app.module}.ts`, `apps/api/src/config/env.ts`, `apps/api/src/common/{problem.filter,zod.pipe}.ts`, `apps/api/src/health/{health.controller,health.module}.ts`, `apps/api/src/db/db.module.ts`
- Test: `apps/api/test/{env.test,health.e2e.test,problem.e2e.test}.ts`

**Interfaces:**
- Consumes: `createDb`, `@arenaz/db/test-setup` (Task 3); `healthResponseSchema`, `Problem` (Task 2).
- Produces:
  - `loadEnv(source: Record<string, string | undefined>): Env` — zod; `Env = { DATABASE_URL: string; REDIS_URL: string; BETTER_AUTH_SECRET: string /* min 32 */; BETTER_AUTH_URL: string /* url */; API_PORT: number /* default 4000 */; WEB_ORIGIN: string /* url */; NODE_ENV: "development"|"test"|"production" }`. Em erro lança `Error` cuja mensagem contém `"Variáveis de ambiente inválidas"` e o nome de cada variável com problema.
  - `createApp(env: Env): Promise<NestFastifyApplication>` em `app.factory.ts` — usado por `main.ts` e por todos os testes e2e (via `app.inject`). Configura: `setGlobalPrefix("api")`, logger pino com `genReqId` (respeita header `x-request-id`), `@fastify/helmet`, `@fastify/rate-limit` (100 req/min por IP; desligado quando `NODE_ENV=test`), `ProblemFilter` global, `enableShutdownHooks()`.
  - Token de injeção `DB` (`Symbol("DB")`) provendo `{ db, pool }` de `createDb(env.DATABASE_URL)`; o pool fecha no `onModuleDestroy`.
  - `ZodPipe(schema)` — `PipeTransform` que retorna `schema.parse(value)` ou lança 422 com `errors` = `flatten().fieldErrors`.
  - `ProblemFilter` — converte `HttpException` em `Problem` (`type: "about:blank"`, `title` = texto pt-BR do status), erros desconhecidos em 500 `title: "Erro interno"` sem stack no corpo (stack só no log). Content-Type `application/problem+json`.
  - `GET /api/health` → 200 `{ status: "ok", db: "up" }`; se `select 1` falhar ou demorar > 1 s → 503 `{ status: "degraded", db: "down" }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// env.test.ts
it("lista variáveis faltando", () => {
  expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
});
it("rejeita secret curto", () => {
  expect(() => loadEnv({ ...valid, BETTER_AUTH_SECRET: "abc" })).toThrow(/BETTER_AUTH_SECRET/);
});
it("API_PORT padrão 4000", () => {
  expect(loadEnv({ ...valid, API_PORT: undefined }).API_PORT).toBe(4000);
});
// health.e2e.test.ts
it("health ok com banco no ar", async () => {
  const res = await app.inject({ method: "GET", url: "/api/health" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok", db: "up" });
});
it("health 503 com banco fora", async () => {
  const down = await createApp({ ...env, DATABASE_URL: "postgres://x:x@127.0.0.1:1/x" });
  const res = await down.inject({ method: "GET", url: "/api/health" });
  expect(res.statusCode).toBe(503);
  expect(res.json()).toEqual({ status: "degraded", db: "down" });
});
it("propaga x-request-id", async () => {
  const res = await app.inject({ method: "GET", url: "/api/health", headers: { "x-request-id": "abc" } });
  expect(res.headers["x-request-id"]).toBe("abc");
});
// problem.e2e.test.ts
it("404 em problem+json", async () => {
  const res = await app.inject({ method: "GET", url: "/api/nao-existe" });
  expect(res.statusCode).toBe(404);
  expect(res.headers["content-type"]).toMatch(/application\/problem\+json/);
  expect(res.json()).toMatchObject({ status: 404, title: "Não encontrado" });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @arenaz/api test`
Expected: FAIL — `createApp`/`loadEnv` inexistentes.

- [ ] **Step 3: Implementar** conforme *Interfaces*. Vitest precisa de `unplugin-swc` (`swc.vite()` em `plugins`) para os decorators do Nest emitirem metadata. `main.ts`: `loadEnv(process.env)` → `createApp` → `listen({ port, host: "0.0.0.0" })`. Script `dev`: `node --watch --env-file=../../.env` sobre o build do SWC, ou `nest start --watch` — o que for mais simples com SWC.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @arenaz/api test && pnpm --filter @arenaz/api typecheck`
Expected: PASS (7 testes), typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): nest/fastify bootstrap with env validation, problem+json and health"
```

---

### Task 5: Autenticação na API

**Files:**
- Create: `apps/api/src/auth/{auth,auth.routes,auth.guard,current-user.decorator,me.controller,auth.module}.ts`
- Modify: `apps/api/src/app.factory.ts` (registrar rotas do auth), `apps/api/src/app.module.ts`
- Test: `apps/api/test/auth.e2e.test.ts`

**Interfaces:**
- Consumes: `Env`, `DB`, `createApp` (Task 4); `signUpSchema`, `meResponseSchema` (Task 2); `schema` (Task 3).
- Produces:
  - `createAuth(env: Env, db: Db): Auth` em `auth.ts` — `betterAuth({ basePath: "/api/auth", secret, baseURL: env.BETTER_AUTH_URL, trustedOrigins: [env.WEB_ORIGIN], database: drizzleAdapter(db, { provider: "pg", schema }), emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true }, session: { expiresIn: 30 dias, updateAge: 1 dia } })`. Um hook `before` em `/sign-up/email` valida o corpo com `signUpSchema` e responde 422 `Problem` com `errors` se falhar; o corpo normalizado (e-mail minúsculo) segue adiante. O mesmo hook em `/sign-in/email` normaliza o e-mail com `emailSchema`.
  - `registerAuthRoutes(fastify: FastifyInstance, auth: Auth): void` — rota `GET|POST /api/auth/*` que monta um `Request` Fetch a partir do request Fastify, chama `auth.handler`, e copia status, headers (cookies via `res.headers.getSetCookie()`, um `reply.header("set-cookie", [...])`) e corpo.
  - E-mail duplicado no cadastro → 422 `Problem` com `detail: "Já existe uma conta com este e-mail"` (mapear o erro `USER_ALREADY_EXISTS` do Better Auth no `after` hook ou no `registerAuthRoutes`).
  - `AuthGuard` (`CanActivate`) — `auth.api.getSession({ headers })`; sem sessão → 401 `Problem` `title: "Não autenticado"`; com sessão, coloca `request.user`.
  - `@CurrentUser()` — param decorator que retorna `request.user`.
  - `GET /api/me` (guardado) → 200 `MeResponse` (validado com `meResponseSchema` antes de responder).

- [ ] **Step 1: Escrever os testes que falham**

```ts
const signUp = (body: object) => app.inject({ method: "POST", url: "/api/auth/sign-up/email", payload: body });
const cookieOf = (res) => res.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

it("cadastro → /me com o cookie", async () => {
  const res = await signUp({ name: "Joao", email: "joao@mail.com", password: "Senha@123" });
  expect(res.statusCode).toBe(200);
  const me = await app.inject({ method: "GET", url: "/api/me", headers: { cookie: cookieOf(res) } });
  expect(me.statusCode).toBe(200);
  expect(me.json()).toMatchObject({ name: "Joao", email: "joao@mail.com" });
});
it("normaliza e-mail no cadastro e no login", async () => {
  await signUp({ name: "Ana", email: "  Ana@Mail.COM ", password: "Senha@123" });
  const res = await app.inject({ method: "POST", url: "/api/auth/sign-in/email",
    payload: { email: "ana@mail.com", password: "Senha@123" } });
  expect(res.statusCode).toBe(200);
});
it("e-mail duplicado → 422 em pt-BR", async () => {
  await signUp({ name: "Bia", email: "bia@mail.com", password: "Senha@123" });
  const res = await signUp({ name: "Bia 2", email: "BIA@mail.com", password: "Senha@123" });
  expect(res.statusCode).toBe(422);
  expect(res.json()).toMatchObject({ detail: "Já existe uma conta com este e-mail" });
});
it("senha fraca → 422 com erro no campo", async () => {
  const res = await signUp({ name: "Caio", email: "caio@mail.com", password: "fraca" });
  expect(res.statusCode).toBe(422);
  expect(res.json().errors.password).toBeDefined();
});
it("/me sem cookie → 401", async () => {
  const res = await app.inject({ method: "GET", url: "/api/me" });
  expect(res.statusCode).toBe(401);
});
it("/me com cookie adulterado → 401", async () => {
  const res = await app.inject({ method: "GET", url: "/api/me",
    headers: { cookie: "better-auth.session_token=forjado" } });
  expect(res.statusCode).toBe(401);
});
it("cookie de sessão é httpOnly e SameSite=Lax", async () => {
  const res = await signUp({ name: "Davi", email: "davi@mail.com", password: "Senha@123" });
  const c = res.cookies.find((c) => c.name.includes("session_token"));
  expect(c).toMatchObject({ httpOnly: true, sameSite: "Lax" });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @arenaz/api test -- auth`
Expected: FAIL — rotas 404.

- [ ] **Step 3: Implementar** conforme *Interfaces*. Se `schema/auth.ts` da Task 3 foi escrito à mão, rodar agora `npx @better-auth/cli generate` e confirmar que não há diff de colunas; se houver, gerar migration nova (nunca editar a `0001`).

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @arenaz/api test`
Expected: PASS (todos os testes das Tasks 4 e 5).

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/db
git commit -m "feat(api): email/password auth with Better Auth, session guard and /me"
```

---

### Task 6: `apps/web` — cadastro, login e conta

**Files:**
- Create: `apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,vitest.config.ts}`, `apps/web/src/app/{layout,page,globals.css}`, `apps/web/src/app/(auth)/entrar/page.tsx`, `apps/web/src/app/(auth)/cadastro/page.tsx`, `apps/web/src/app/conta/page.tsx`, `apps/web/src/lib/{auth-client,session,safe-next}.ts`, `apps/web/src/components/auth/{sign-up-form,sign-in-form}.tsx`, `apps/web/src/components/brand/logo.tsx`
- Test: `apps/web/src/components/auth/sign-up-form.test.tsx`, `apps/web/src/lib/safe-next.test.ts`

**Interfaces:**
- Consumes: `signUpSchema`, `signInSchema`, `MeResponse`, `Problem` (Task 2); endpoints `/api/auth/*` e `/api/me` (Task 5).
- Produces:
  - `next.config.ts`: `rewrites()` → `{ source: "/api/:path*", destination: \`${process.env.API_URL}/api/:path*\` }`; `typedRoutes: true`.
  - `authClient = createAuthClient()` de `better-auth/react` (sem `baseURL`: mesma origem).
  - `getSession(): Promise<MeResponse | null>` em `session.ts` (server-only) — `fetch(\`${API_URL}/api/me\`, { headers: { cookie: (await cookies()).toString() }, cache: "no-store" })`; 401 → `null`; outros erros → lança.
  - `safeNext(value: string | null | undefined, fallback = "/conta"): string` — só aceita caminho relativo começando com `/` e sem `//` ou `\`; senão `fallback` (evita open redirect).
  - `/conta` (server component): `getSession()`; `null` → `redirect("/entrar?next=/conta")`; senão mostra "Olá, {name}" e botão "Sair" (`authClient.signOut()` → `/`).
  - `/cadastro` e `/entrar`: formulários `react-hook-form` + `zodResolver(signUpSchema | signInSchema)`; erros de campo do servidor (`Problem.errors`) aparecem no campo; `Problem.detail` aparece como alerta (`role="alert"`). Sucesso → `router.replace(safeNext(searchParams.next))`.
  - `/` : placeholder com o logo atual e links "Entrar" / "Criar conta" (as telas do protótipo vêm no Plano 2).
  - Tailwind v4 via `@import "tailwindcss"` em `globals.css`, com um bloco `@theme` contendo os tokens da tabela de `docs/design/prototipo-v2.md` (cores, sombras, ease); `<html lang="pt-BR">`.
  - Fontes por `next/font/google`: Geist (corpo) e Bricolage Grotesque 800 (só wordmark); `components/brand/logo.tsx` com o SVG atual + wordmark "arenaz", usado no topo das três páginas.
  - Formulários no visual do protótipo: inputs com borda `--color-line-strong`, botão primário `--color-brand` raio 14px, card central com `--shadow-2`. Sem copiar telas do protótipo além disso.

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// safe-next.test.ts
it.each([
  ["/conta", "/conta"], ["/reservas?x=1", "/reservas?x=1"],
  ["//evil.com", "/conta"], ["https://evil.com", "/conta"], ["/\\evil.com", "/conta"], [undefined, "/conta"],
])("safeNext(%s) → %s", (input, out) => expect(safeNext(input)).toBe(out));

// sign-up-form.test.tsx (Testing Library + jsdom; authClient mockado)
it("mostra erro de senha fraca sem chamar a API", async () => {
  render(<SignUpForm />);
  await user.type(screen.getByLabelText("Nome"), "Joao");
  await user.type(screen.getByLabelText("E-mail"), "joao@mail.com");
  await user.type(screen.getByLabelText("Senha"), "fraca");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  expect(await screen.findByText(/8\+ caracteres/)).toBeVisible();
  expect(authClient.signUp.email).not.toHaveBeenCalled();
});
it("mostra detail do servidor quando e-mail já existe", async () => {
  vi.mocked(authClient.signUp.email).mockResolvedValue({ error: { status: 422, message: "Já existe uma conta com este e-mail" } });
  // preencher válido e enviar
  expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma conta com este e-mail");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @arenaz/web test`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Implementar** conforme *Interfaces*. Confirmar como o client do Better Auth expõe o corpo de erro do servidor (`error.message` vs. corpo bruto) e adaptar o mapeamento de `Problem` → campos num único helper em `auth-client.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @arenaz/web test && pnpm --filter @arenaz/web build`
Expected: PASS; `next build` sem erros de tipo ou lint.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): next app with sign-up, sign-in and protected account page"
```

---

### Task 7: E2E do fluxo de conta + CI

**Files:**
- Create: `apps/web/e2e/{playwright.config.ts,auth.spec.ts}`, `.github/workflows/ci.yml`
- Modify: `package.json` raiz (script `e2e`), `turbo.json` (task `e2e`, sem cache)

**Interfaces:**
- Consumes: todo o resto.
- Produces: `pnpm e2e` sobe API (porta 4000) e web (porta 3000) via `webServer` do Playwright contra o Postgres do `docker compose`, roda migrations antes (`pnpm --filter @arenaz/db migrate`, script novo que chama `runMigrations(process.env.DATABASE_URL)`).

- [ ] **Step 1: Escrever o teste e2e**

```ts
test("criar conta, sair e entrar de novo", async ({ page }) => {
  const email = `e2e+${Date.now()}@mail.com`;
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Jogador E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Senha@123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL("/conta");
  await expect(page.getByText("Olá, Jogador E2E")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await page.goto("/entrar?next=/conta");
  await page.getByLabel("E-mail").fill(email.toUpperCase());
  await page.getByLabel("Senha").fill("Senha@123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/conta");
});
test("cookie adulterado em /conta redireciona para login", async ({ page, context }) => {
  await context.addCookies([{ name: "better-auth.session_token", value: "forjado", url: "http://localhost:3000" }]);
  await page.goto("/conta");
  await expect(page).toHaveURL("/entrar?next=%2Fconta");
});
```

- [ ] **Step 2: Rodar**

Run: `pnpm db:up && pnpm e2e`
Expected: 2 passed. (Se falhar, é bug real das Tasks 5/6 — corrigir lá, não no teste.)

- [ ] **Step 3: Workflow de CI** `.github/workflows/ci.yml`: gatilhos `pull_request` e `push` em `main`; `permissions: contents: read`; `concurrency` cancelando execuções antigas do mesmo ref; job único `ubuntu-latest` com `services.postgres` (`postgis/postgis:17-3.5`, healthcheck) → `actions/checkout`, `pnpm/action-setup`, `actions/setup-node` (`node-version-file: .nvmrc`, `cache: pnpm`) — **cada uma fixada por SHA de commit com comentário da versão** → `pnpm install --frozen-lockfile` → `pnpm turbo run lint typecheck test build` → `pnpm exec playwright install --with-deps chromium` → `pnpm e2e`. Testcontainers funciona no runner (Docker disponível); `.env` de CI montado com valores fixos de teste no próprio YAML (`BETTER_AUTH_SECRET` de teste, não um secret).

- [ ] **Step 4: Verificar CI**

Run: `git push -u origin feat/v2-foundation` e abrir PR draft para `main`.
Expected: job `ci` verde.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e .github package.json turbo.json packages/db
git commit -m "ci: lint, typecheck, unit, integration and e2e on every PR"
```

---

## Definição de pronto do Plano 0

- `pnpm i && pnpm db:up && pnpm dev` sobe web em `:3000` e API em `:4000` numa máquina limpa seguindo só o README.
- Os 5 itens do *Review Focus* têm teste passando.
- CI verde no PR; nenhum `any` explícito, `@ts-ignore` ou `eslint-disable` sem comentário justificando.
- Próximo: Plano 1 (domínio do dono) e Plano 2 (design system a partir do protótipo aprovado) podem começar em paralelo.
