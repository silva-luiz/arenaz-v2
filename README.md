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
pnpm db:up             # sobe Postgres, Redis e MinIO (bucket de fotos) e espera
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

Se 3000, 4000, 5432, 6379, 9000 ou 9001 já estiverem ocupadas, troque as portas assim:

- `API_PORT` e `WEB_PORT` vão no `.env` da raiz (ajuste também `API_URL`,
  `WEB_ORIGIN` e `BETTER_AUTH_URL`).
- `POSTGRES_PORT`, `REDIS_PORT`, `MINIO_PORT` (padrão 9000) e
  `MINIO_CONSOLE_PORT` (padrão 9001) são lidas pelo Docker Compose, que lê
  `infra/.env` e não o `.env` da raiz: exporte-as no shell antes de
  `pnpm db:up` (`export POSTGRES_PORT=5433 REDIS_PORT=6380` no bash;
  `$env:POSTGRES_PORT='5433'` no PowerShell). `MINIO_PORT` também precisa
  estar exportada, como `POSTGRES_PORT`.
- Acompanhe a mudança em `DATABASE_URL` e `REDIS_URL` no `.env`
  (ex.: `postgres://arenaz:arenaz@localhost:5433/arenaz`) e, se mudar
  `MINIO_PORT`, em `S3_ENDPOINT` e `S3_PUBLIC_URL`.

### Fotos (MinIO)

As fotos dos espaços vão direto do navegador para um storage compatível com S3
(URL assinada); a API nunca recebe os bytes. Localmente isso é o MinIO do
`pnpm db:up`:

- API S3 em http://localhost:9000 (`MINIO_PORT`) e console em
  http://localhost:9001 (`MINIO_CONSOLE_PORT`).
- Usuário e senha **só para uso local**: `minioadmin` / `minioadmin`
  (já estão no `.env.example` como `S3_ACCESS_KEY_ID` e
  `S3_SECRET_ACCESS_KEY`).
- O serviço `minio-init` cria o bucket `arenaz-photos` (idempotente) com
  leitura pública anônima dos objetos; ele roda uma vez e sai com código 0.
- A imagem (`alpine/minio`, build automático da release oficial; o MinIO não
  publica mais `minio/minio` no Docker Hub) é fixada por tag de release em
  `infra/docker-compose.yml`; os testes (`pnpm test`) sobem o mesmo MinIO via Testcontainers.

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
