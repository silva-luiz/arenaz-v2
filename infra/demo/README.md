# Dados de demonstração

## Demo com link público: `pnpm demo`

Um comando sobe tudo nesta máquina e imprime um link público:

```bash
pnpm demo          # usa o banco arenaz_demo; cria e preenche se não existir
pnpm demo --seed   # refaz os dados de demonstração antes de subir
```

O que ele faz: sobe Postgres, Redis e MinIO; abre dois túneis do Cloudflare
(site na porta 3200, que também repassa `/api` para a API, e fotos no MinIO,
porta 9000, porque o navegador baixa as fotos direto do bucket); compila com
esses endereços; liga API (4200), worker e site; espera o link responder.
Ctrl+C desliga tudo o que ele ligou.

Precisa de Docker e do `cloudflared` (`winget install Cloudflare.cloudflared`,
ou `CLOUDFLARED_BIN` apontando para o binário). O link muda a cada execução e
a demo cai quando a máquina desliga. A senha das contas fica em
`infra/demo/.env.demo` (criada na primeira vez, fora do git).

## Seed manual

Preenche um banco **separado** (`arenaz_demo`) com os 13 espaços e as fotos do
protótipo aprovado, para ver as telas com dados realistas sem mexer no banco de
desenvolvimento.

## O que entra

- 13 espaços publicados em São Paulo/SP (slugs fixos, como `arena-vila-madalena`
  e `padel-pinheiros`), cada um com uma quadra, horário 07:00–24:00 todos os dias,
  política de cancelamento moderada e fuso `America/Sao_Paulo`. A Arena Vila
  Madalena tem 5 fotos, a quadra "Society 1" (7x7, R$ 180/h) e a faixa nobre
  19:00–23:00 a R$ 220/h.
- 2 contas, ambas com a senha de `DEMO_PASSWORD`:
  - `marcos@demo.arenaz.test` (Marcos Silva), dono de todos os espaços;
  - `jogador@demo.arenaz.test` (Gabriel Ribeiro), jogador.
- Reservas confirmadas de hoje e de amanhã (do app e manuais) para gerar
  "Ocupado" e a agenda do dono.
- `photos/`: as 21 fotos do protótipo (Unsplash, uso comercial livre),
  reduzidas a no máximo 1600 px no maior lado, JPEG q80, sem EXIF. O seed envia
  as fotos para o mesmo storage S3/MinIO da API (`venues/<id>/<uuid>.jpg`).

Não há notas, avaliações nem contadores inventados aqui: esses dados de
demonstração ficam em `apps/web/src/lib/demo/`.

## Como rodar

Pré-requisitos: Postgres e MinIO no ar (`pnpm db:up`), `.env` na raiz com as
variáveis de `S3_*`, e os pacotes compilados
(`pnpm turbo run build --filter @arenaz/api^...`).

```bash
# Senha das contas de demonstração (mínimo de 12 caracteres), fora do git:
echo "DEMO_PASSWORD=$(openssl rand -base64 18)" > infra/demo/.env.demo

set -a; . infra/demo/.env.demo; set +a
DATABASE_URL=postgres://arenaz:arenaz@localhost:5433/arenaz_demo \
  pnpm --filter @arenaz/api demo:seed
```

`infra/demo/.env.demo` está no `.gitignore`. Nunca coloque a senha no
repositório.

O comando cria o banco `arenaz_demo` se ele não existir, aplica as migrations e
faz o seed. Pode rodar de novo quando quiser: ele apaga e recria tudo o que
pertence ao dono demo (reservas, espaços, quadras, fotos) e deixa o resto do
banco como está. As contas são criadas uma única vez.

## Salvaguardas

O seed apaga dados, então recusa rodar com `NODE_ENV=production` e em qualquer
banco cujo nome não termine em `_demo`. Para apontar a API e o web para o banco
de demonstração, use o mesmo `DATABASE_URL` ao iniciá-los.
