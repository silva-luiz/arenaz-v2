# ArenaZ v2 — Design

**Data:** 2026-10-28
**Status:** rascunho para revisão

## 1. Produto

ArenaZ v2 é um marketplace de dois lados para aluguel de espaços esportivos por hora — o "Airbnb de quadra", começando por futebol (society, futsal, campo) e abrindo para areia (beach tennis, futevôlei), padel e tênis.

- **Jogador (guest):** encontra uma quadra perto, vê fotos, horários livres e preço real, reserva e paga em menos de 1 minuto.
- **Dono (host):** publica o espaço, controla agenda, preços, mensalistas e recebe automaticamente.

O v1 (este repositório até `legacy-v1`) só cobre o painel do dono, sem lado do jogador e sem backend próprio.

### Onde ganhar do Airbnb (e do WhatsApp, o concorrente real)

| Airbnb faz | ArenaZ precisa fazer melhor, porque esporte é diferente |
|---|---|
| Reserva por noite | Reserva por slot de 30/60/90 min com **reserva instantânea** como padrão |
| Hóspede paga sozinho | **Racha**: o organizador divide o valor e cada jogador paga sua parte por link Pix |
| Estadia pontual | **Mensalista**: reserva recorrente semanal, cobrança recorrente, prioridade de renovação |
| Busca por datas | Busca por "hoje 20h, society 7x7, até 5 km" — horário é o filtro principal |
| Preço por noite | Preço por faixa (horário nobre / fora de pico / fim de semana) definido pelo dono |
| Avaliação do lugar | Avaliação nos dois sentidos + selo de quadra verificada (fotos/medidas reais) |
| — | "Falta 2": partida aberta para completar time (fase posterior) |

## 2. Decisão: recomeçar, usando o v1 como referência

O v1 tem ~2 mil linhas de front, `strict: false`, `ignoreBuildErrors: true`, três sistemas de estilo misturados (Bootstrap, Tailwind, SCSS), `react-router-dom` dentro do Next, URL de ngrok fixa no código e dados mockados. O modelo de dados (`usr_*`, `est_*`, `are_*`) vem de um backend Laravel que não está aqui. Migrar custaria mais do que reescrever, e o produto novo (marketplace) tem outro centro de gravidade.

Do v1 aproveitamos: vocabulário de domínio (estabelecimento → arena/quadra → reserva), fluxos do dono (cadastro em 2 etapas, dashboard, nova arena, confirmação de reserva), regras de senha, categorias e textos em pt-BR. O código fica acessível pela tag `legacy-v1`; `docs/legacy/app-functionalities.md` preserva a descrição funcional.

## 3. Arquitetura

### Monorepo

```
apps/
  web/        Next.js — site público, busca, checkout, painel do dono (mobile-first, SSR para SEO)
  api/        NestJS (Fastify) — API REST, autenticação, regras de negócio
  worker/     (plano 3+) jobs BullMQ: expirar holds, notificações, cobranças recorrentes
  mobile/     (futuro) Expo, consome packages/contracts
packages/
  contracts/  schemas zod + tipos compartilhados entre web, api e mobile
  db/         Drizzle: schema, migrations, client
  ui/         (plano 2) design system: tokens, componentes
  config/     tsconfig, eslint, prettier compartilhados
infra/
  docker-compose.yml   Postgres+PostGIS, Redis
```

pnpm workspaces + Turborepo. Tudo TypeScript `strict`, ESM.

### Escalabilidade — princípios

1. **API sem estado** (sessão no Postgres, cache no Redis) → escala horizontal atrás de load balancer.
2. **Postgres é a fonte da verdade e garante o invariante mais caro do negócio**: nunca duas reservas ativas sobrepostas na mesma quadra. Isso é uma `EXCLUDE USING gist (field_id WITH =, period WITH &&) WHERE (status IN ('held','confirmed'))` — não um `SELECT` antes do `INSERT`. Precisa da extensão `btree_gist`.
3. **Geo nativo**: PostGIS `geography(Point)` + índice GiST para "quadras a até X km". Motor de busca dedicado (Typesense/Meilisearch) só quando o Postgres não der conta.
4. **Trabalho lento fora do request**: holds de checkout expiram em 10 min via job; webhooks de pagamento e notificações passam por fila (BullMQ/Redis), com outbox transacional.
5. **Fotos em object storage** (S3/R2) com upload direto por URL assinada + CDN; a API nunca trafega bytes de imagem.
6. **Observabilidade desde o dia 1**: logs estruturados (pino) com request id, health check que testa o banco, OpenTelemetry no plano de operação.

### Modelo de domínio (alto nível; detalhado no plano 1)

- `user` — conta única; vira host ao criar um `venue`.
- `venue` (estabelecimento) — endereço, `location geography(Point,4326)`, comodidades, fotos, horário de funcionamento, política de cancelamento.
- `field` (quadra/arena) — esporte(s), piso, dimensões/formato (5x5, 7x7…), duração mínima do slot, preço base/hora.
- `price_rule` — faixa de dia/hora com preço próprio.
- `availability_block` — bloqueios manuais (manutenção, evento).
- `booking` — `field_id`, `period tstzrange`, `status` (`held`/`confirmed`/`cancelled`/`completed`), `total_cents`, origem (app/manual pelo dono).
- `recurring_booking` — mensalista; gera `booking`s.
- `payment`, `payout`, `review`, `conversation/message` — planos posteriores.

## 4. Requisitos globais

- Node.js Active LTS (≥ 24); pnpm ≥ 10; TypeScript ≥ 5.9 `strict`.
- Next.js ≥ 16, React ≥ 19.2, Tailwind CSS ≥ 4.1, NestJS ≥ 11, PostgreSQL ≥ 17 + PostGIS ≥ 3.5, Redis ≥ 7.
- Versões: sempre a última estável no momento da execução (`pnpm view <pkg> version`), nunca `latest`/`*` no `package.json`.
- Interface e mensagens de erro em **pt-BR**; identificadores de código em inglês.
- Dinheiro: inteiro em **centavos BRL** (`*_cents`), nunca float.
- Datas: `timestamptz` em UTC no banco; exibição em `America/Sao_Paulo`.
- Senha: mínimo 8 caracteres com maiúscula, minúscula, número e caractere especial (regra do v1).
- E-mail: normalizado com `trim` + minúsculas antes de qualquer comparação.
- LGPD: coletar o mínimo, consentimento explícito nos termos, exclusão de conta possível (plano 4).
- Acessibilidade WCAG 2.2 AA; mobile-first (≥ 70% do uso esperado no celular).
- GitHub Actions: `permissions: contents: read` por padrão, actions de terceiros fixadas por SHA, nenhum secret em jobs de PR.

## 4.1 Identidade visual

Protótipo aprovado em 2026-10-28: `docs/design/prototipo-v2.md` (tokens, telas, logo). Toda tela nova segue esses tokens. O logo atual fica até nova decisão.

## 5. Roadmap de planos

Cada plano entrega software funcionando e testável sozinho.

| # | Plano | Entrega | Depende de |
|---|---|---|---|
| 0 | **Fundação** | monorepo, CI, Postgres/Redis, API com health + auth, web com cadastro/login/conta | — |
| 1 | Domínio do dono | venue, field, price_rule, bloqueios; CRUD no painel; upload de fotos | 0 |
| 2 | Design system | `packages/ui` a partir do protótipo aprovado (`docs/design/prototipo-v2.md`): tokens, componentes e as telas da jornada do jogador e do dono em código. O protótipo navegável já existe; o logo atual é mantido | 0 (pode rodar em paralelo ao 1) |
| 3 | Motor de reservas | disponibilidade, cálculo de preço, hold → confirm, constraint de exclusão, worker de expiração | 1 |
| 4 | Pagamentos | Pix + cartão via PSP com split (ex.: Stripe Connect ou Pagar.me), reembolso por política, repasse ao dono | 3 |
| 5 | Mensalista + racha | reservas recorrentes, divisão de pagamento entre jogadores | 4 |
| 6 | Confiança e engajamento | avaliações, mensagens, notificações (e-mail/WhatsApp), quadra verificada | 3 |
| 7 | Operação | deploy, OpenTelemetry, rate limit distribuído, backups, load test do motor de reservas | 3 |
