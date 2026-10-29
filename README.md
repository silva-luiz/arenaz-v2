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
  publica mais `minio/minio` no Docker Hub) é fixada por **tag de release e
  digest** (`tag@sha256:...`) em `infra/docker-compose.yml`, e o `minio-init`
  (`amazon/aws-cli`) também. Para atualizar, troque a tag **e** o digest
  juntos (e o mesmo em `.github/workflows/ci.yml`); trocar só a tag mantém o
  digest antigo e o Docker continua usando a imagem antiga. Os testes
  (`pnpm test`) sobem o mesmo MinIO via Testcontainers.
- CORS: o painel envia a foto com um POST do navegador direto ao storage
  (origem diferente da web). O MinIO local aceita qualquer origem por padrão
  (`MINIO_API_CORS_ALLOW_ORIGIN=*`), então nada a configurar em desenvolvimento.
  **Em produção (S3, R2 etc.) é preciso configurar o CORS do bucket**: permitir
  a origem da web (`WEB_ORIGIN`) com o método `POST`; sem isso o navegador
  bloqueia o envio das fotos.
- Produção: o envio depende de **POST pré-assinado do S3** (política com
  `content-length-range` e `Content-Type` exato, que é o que limita tamanho e
  tipo no próprio storage). O Cloudflare R2 pode não suportar POST
  pré-assinado; num provedor sem esse recurso será preciso uma variante com
  PUT pré-assinado (e validar tipo e tamanho na confirmação).

### Limite de requisições (rate limit)

A API limita por IP: 100 requisições por minuto no total e 60 por minuto nas
rotas públicas de busca (`GET /api/venues`, `GET /api/venues/:slug`). O
servidor da web (Next SSR) chama a API sempre do mesmo IP, então ele envia o
cabeçalho `x-internal-token` com o valor de `INTERNAL_API_TOKEN` (mínimo de 32
caracteres; gere como no `.env.example`) e fica isento dos limites. A
comparação é em tempo constante; sem `INTERNAL_API_TOKEN` o recurso fica
desligado. O token é só de servidor para servidor e o navegador nunca o vê.

> Pendente para o deploy (Plano 7): encaminhar o IP real do cliente (`trustProxy`
> / `X-Forwarded-For`) para que o limite por IP funcione atrás de proxy.

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
