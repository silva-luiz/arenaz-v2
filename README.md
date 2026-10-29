# ArenaZ

Marketplace para alugar quadras esportivas por hora.

## Pré-requisitos

- Node 24 LTS (`.nvmrc`)
- pnpm
- Docker

## Setup

```bash
pnpm i
cp .env.example .env   # preencha BETTER_AUTH_SECRET (veja abaixo)
pnpm db:up             # sobe Postgres e Redis e espera ficarem saudáveis
pnpm db:migrate
pnpm dev
```

Web em http://localhost:3000 e API em http://localhost:4000.

`BETTER_AUTH_SECRET` precisa de ao menos 32 caracteres. Gere com
`openssl rand -base64 32` ou, no Windows (sem openssl):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Portas

Se 3000, 4000, 5432 ou 6379 já estiverem ocupadas, troque as portas assim:

- `API_PORT` e `WEB_PORT` vão no `.env` da raiz (ajuste também `API_URL`,
  `WEB_ORIGIN` e `BETTER_AUTH_URL`).
- `POSTGRES_PORT` e `REDIS_PORT` são lidas pelo Docker Compose, que lê
  `infra/.env` e não o `.env` da raiz: exporte-as no shell antes de
  `pnpm db:up` (`export POSTGRES_PORT=5433 REDIS_PORT=6380` no bash;
  `$env:POSTGRES_PORT='5433'` no PowerShell).
- Acompanhe a mudança em `DATABASE_URL` e `REDIS_URL` no `.env`
  (ex.: `postgres://arenaz:arenaz@localhost:5433/arenaz`).

## Testes

```bash
pnpm test    # unitários e integração; precisa do Docker rodando (Testcontainers)
```

E2E (Playwright, sobe API e web em 3100/4100):

```bash
pnpm --filter @arenaz/web exec playwright install chromium   # só na primeira vez
pnpm e2e
```

## Legado

O v1 está na tag `legacy-v1`.
