# Dados de demonstração

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
