# Demo no Cubeship

Link fixo: **https://arenaz.5-189-167-204.sslip.io** (fotos em
`https://arenaz-fotos.5-189-167-204.sslip.io`). Mesmos dados do `pnpm demo`:
13 espaços, contas `marcos@demo.arenaz.test` (dono) e
`jogador@demo.arenaz.test` (jogador), senha em `infra/demo/.env.demo`
(`DEMO_PASSWORD_CUBESHIP`).

## O que roda (projeto `arenaz`, ambiente `production`)

| App / banco    | O quê                                                     |
| -------------- | --------------------------------------------------------- |
| `web`          | Next na porta 3200, domínio do site, faz proxy de `/api`  |
| `api`          | NestJS na 4200, só interna; predeploy aplica migrations    |
| `worker`       | BullMQ: variantes WebP das fotos e expiração de reservas  |
| `db`           | `postgis/postgis:17-3.5` com volume (o Postgres gerenciado não tem PostGIS) |
| `s3`           | MinIO (`minio.Dockerfile`) com volume, bucket `arenaz-photos` público para leitura |
| `arenaz-redis` | Redis gerenciado, ligado à `api` e ao `worker`            |

`NODE_ENV=development` na API e no worker: com `PAYMENT_PROVIDER=fake` a API
não sobe em produção. `S3_ENDPOINT` é o endereço público do MinIO, porque o
upload direto do navegador usa o POST pré-assinado dele.

Os segredos (senha do Postgres, do MinIO, `BETTER_AUTH_SECRET`,
`INTERNAL_API_TOKEN`) ficam só nas variáveis das apps no Cubeship.

## Atualizar

```bash
docker login registry.5-189-167-204.sslip.io -u <usuário>   # senha = chave da API do Cubeship
R=registry.5-189-167-204.sslip.io/arenaz/production
TAG=demo2
for t in api worker web; do
  docker build -f infra/deploy/Dockerfile --target $t \
    --build-arg SITE_URL=https://arenaz.5-189-167-204.sslip.io -t $R/$t:$TAG .
  docker push $R/$t:$TAG
done
```

O push de uma tag nova já faz o deploy de cada app. O site e o `/api` vêm
embutidos no build da `web`: mudou o domínio, refaça o build.

## Recriar os dados da demo

O seed apaga e recria tudo do dono demo. Para rodar de novo: coloque
`DEMO_PASSWORD` nas variáveis da `api`, troque o predeploy dela por
`node scripts/demo-seed.ts`, faça o deploy, depois volte o predeploy para
`node ../../packages/db/dist/migrate.js` e tire o `DEMO_PASSWORD`.
