# ArenaZ

Marketplace para alugar quadras esportivas por hora.

## Pré-requisitos

- Node 24 LTS (`.nvmrc`)
- pnpm
- Docker

## Setup

```bash
pnpm i
cp .env.example .env   # preencha BETTER_AUTH_SECRET com: openssl rand -base64 32
pnpm db:up
pnpm db:migrate
pnpm dev
```

Web em http://localhost:3000 e API em http://localhost:4000.

## Legado

O v1 está na tag `legacy-v1`.
