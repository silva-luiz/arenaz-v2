# ArenaZ v2 — Paridade com o protótipo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o app (home, busca, página da quadra, checkout/reserva, home mobile e painel do dono) visualmente igual ao protótipo aprovado, com dados de demonstração reais no banco e dados fictícios só onde a funcionalidade ainda não existe.

**Architecture:** Um seed idempotente (`apps/api/scripts/demo-seed.ts`) popula um banco separado `arenaz_demo` com os 13 espaços do protótipo e suas fotos. A API ganha o "próximo horário livre" nos cards e filtros reais de busca. As telas são refeitas a partir dos `.dc.html` do protótipo, reaproveitando `packages/ui`. Tudo que o produto ainda não tem (avaliações, racha, partidas abertas, favoritos, mensalistas, repasse) vem de fixtures em `apps/web/src/lib/demo/` e só aparece com `NEXT_PUBLIC_DEMO_MODE=true`.

**Tech Stack:** pnpm + Turborepo, Node 24, TypeScript 6, NestJS/Fastify, Drizzle + Postgres 17/PostGIS, Next 16 App Router, Tailwind v4, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md` (§4 requisitos globais, §4.1 identidade visual) + `docs/design/prototipo-v2.md` + as telas `docs/design/prototipo/{Main,Busca,Quadra,Checkout,MobileHome,Painel}.dc.html`. Os `.dc.html` são a fonte da verdade visual: estrutura, copy e valores de estilo inline (raios, sombras, tamanhos, cores). Eles não rodam sozinhos (`/_blob/<id>` e `{{…}}` são do runtime do canvas); a lógica de cada tela está no `<script>` `class Component` ao final do arquivo.

## Global Constraints

- Interface e mensagens em pt-BR; identificadores em inglês.
- Visual: só os tokens/fontes/logo de `docs/design/prototipo-v2.md`. Logo atual — não use nenhum logo novo.
- Versões: última estável na hora (`pnpm view <pkg> version`), nunca `latest`/`*`.
- Dinheiro em centavos inteiros (`*_cents`); horários exibidos no fuso do espaço.
- WCAG 2.2 AA (nomes acessíveis, foco visível, teclado, contraste ≥ 4.5:1 em texto), `prefers-reduced-motion` desliga lift/parallax/transições, mobile-first, sem scroll horizontal da página em 375 px.
- Nunca push em `main`. Commits em `dev/redesign`, um por task (fix rounds podem somar commits).
- Docker é necessário para Testcontainers e `pnpm db:up`; se não estiver rodando, avise em vez de pular testes.
- Portas 3000/3100/4000 são de outros projetos: e2e roda com `E2E_WEB_PORT=3102 E2E_API_PORT=4102`, e use `POSTGRES_PORT=5433 REDIS_PORT=6380`. Turbo com `--concurrency=2`.
- Fictício só em modo demo: qualquer dado inventado (nota, nº de avaliações, textos de avaliação, "Dono destaque", partidas abertas, racha, favoritos, mensalistas, repasse, contadores de marketing como "312 quadras livres") vem de `apps/web/src/lib/demo/` e não renderiza quando `NEXT_PUBLIC_DEMO_MODE` não é `'true'`. Ilustrações de marketing sem dado falso sobre um espaço real (cartões flutuantes do hero, mini painel do banner do dono) aparecem sempre.
- Nada de taxa de serviço: o total é o preço real da reserva. "Por pessoa" = total ÷ jogadores, arredondado para cima ao centavo, só exibido.
- Nenhum controle que finge funcionar fora do modo demo: filtro/chip/botão sem efeito real não aparece em produção.
- Componentes compartilhados vão em `packages/ui` (atualize `venue-card`, `search-bar`, `site-header`, `gallery`, `tab-bar`, `theme.css`); nada de copiar estilo inline do protótipo para um one-off quando um componente de `packages/ui` cobre o caso.
- Fotos de exemplo: as do protótipo (Unsplash, uso comercial livre), em `infra/demo/photos/`. O crédito "Fotos: Unsplash" aparece no rodapé só no modo demo.

## Review Focus

- Card ou tela de um espaço sem foto, sem `nextFreeTime` ou com nome longo (40+ caracteres): deve degradar sem quebrar layout (placeholder, sem selo, nome com reticências em 2 linhas).
- Modo demo desligado: nenhuma nota, avaliação, coração, "Falta gente", racha ou indicador fictício aparece; a página continua coerente sem buracos.
- 375 px de largura: home mobile, busca (lista sobre o mapa), página da quadra e checkout sem scroll horizontal e com alvos de toque ≥ 44 px.
- `nextFreeTime` perto da meia-noite e em espaço que fecha depois de 00:00: só horários de hoje no fuso do espaço, nunca um horário que já passou.
- Teclado e leitor de tela no seletor de horários e nos pinos do mapa: cada controle alcançável por Tab, com nome que diz horário/preço/estado.

---

## Shared Interfaces

```ts
// packages/contracts/src/public-venue.ts — publicVenueCardSchema ganha:
nextFreeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(), // "20:00" ou "19:30"; null = nada livre hoje
// publicSearchQuerySchema ganha (opcionais):
amenities: string CSV de AMENITIES (ex.: "coberta,vestiario"), todos exigidos (AND)
maxPrice: inteiro em reais, 1..10000 → filtra minPriceCentsPerHour <= maxPrice*100
// apps/web/src/lib/demo/index.ts
export const isDemoMode: boolean; // process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
export function demoVenueExtras(slug: string): DemoVenueExtras | null; // null fora do modo demo ou slug sem fixture
export interface DemoVenueExtras { rating: string; reviewsCount: number; badge?: string; hostHighlight?: string; reviews: DemoReview[]; subRatings: { label: string; value: string }[] }
export const demoOpenGames: DemoOpenGame[]; // "Falta gente"
export const demoOwnerStats: { payoutCents: number; payoutDay: string; monthlyTeams: number; renewingThisWeek: number };
```

---

### Task 1: Seed de demonstração

**Files:**
- Create: `infra/demo/photos/*.jpg` (21 fotos, de `C:\Users\gabri\AppData\Local\Temp\claude\C--Users-gabri-Documents-projects-arenaz-v2\96beafe1-0e33-49f4-91de-a303c590a9ce\scratchpad\proto-photos\`, re-encodadas com o maior lado ≤ 1600 px, JPEG q≈80, sem EXIF), `infra/demo/README.md`
- Create: `apps/api/scripts/demo-seed.ts`, `apps/api/scripts/demo-data.ts`, `apps/api/test/demo-seed.test.ts`
- Modify: `apps/api/package.json` (script `demo:seed`), `.env.example` (bloco `DEMO_PASSWORD`, `arenaz_demo`)

**Interfaces:**
- Produces: banco `arenaz_demo` com slugs determinísticos (`arena-vila-madalena`, `society-pinheiros`, `pacaembu-futsal-club`, `quadra-coberta-perdizes`, `arena-lapa-7`, `campo-ibirapuera-fc`, `futevolei-praia-urbana`, `padel-pinheiros`, `beach-lapa-sunset`, `saibro-butanta`, `raquete-clube-sumare`, `futsal-ball-mooca`, `sumare-society`); contas `marcos@demo.arenaz.test` (dono de todos, nome "Marcos Silva") e `jogador@demo.arenaz.test` (nome "Gabriel Ribeiro"). Task 3+ usam esses slugs nas fixtures.

- [ ] **Step 1: Write the failing test** `apps/api/test/demo-seed.test.ts` (Testcontainers, como os outros testes de integração da API): roda `runDemoSeed({ db, storage, password: 'Demo#2026senha', now })` duas vezes e verifica: 13 espaços `published`, todos do dono demo; `arena-vila-madalena` tem 5 fotos e quadra "Society 1" 7x7 com base R$ 180/h e regra 19:00–23:00 R$ 220/h todos os dias; contagens iguais após a 2ª execução (idempotente); há ≥ 3 reservas `confirmed` hoje entre 16h e 23h na Vila Madalena, com `origin` `app` e `manual`; `runDemoSeed` lança erro se `NODE_ENV === 'production'` ou se o nome do banco não terminar em `_demo`.
- [ ] **Step 2: Run** `pnpm --filter @arenaz/api test -- demo-seed` → FAIL (módulo não existe).
- [ ] **Step 3: Implement** `demo-data.ts` (dados puros) e `demo-seed.ts` (`runDemoSeed` + `main()` CLI). Dados: os 13 espaços de `Main.dc.html` (~linhas 341-354) e `Busca.dc.html` (~148-153) — nome, foto, esporte, piso, formato, preço por hora; bairro e cidade São Paulo/SP com coordenadas reais do bairro; descrição curta pt-BR; comodidades coerentes com o `meta` (ex.: "coberta" → `coberta`, "bar" → `bar`); horário 07:00–24:00 seg-dom (`close_minute` 1440); política `moderada`; fuso `America/Sao_Paulo`. Fotos: a principal de cada espaço é a do protótipo; a Vila Madalena recebe as 5 da galeria de `Quadra.dc.html` (society-night, hero-night, ball-turf, warmup, society-aerial — confira a ordem no arquivo). Upload via o mesmo `StoragePort`/S3 da API (chaves `venues/<venueId>/<uuid>.jpg`). Reservas de hoje e amanhã para gerar "Ocupado" e agenda: mistura de `app` (do jogador demo) e `manual` (nomes como "Pelada da Firma", "Rafael"). Idempotência: apaga e recria tudo que pertence ao dono demo (reservas → fotos/objetos → quadras → espaços) numa transação; contas são criadas uma vez com o hash de senha do Better Auth (`hashPassword` de `better-auth/crypto`). Senha só por `DEMO_PASSWORD` (≥ 12 caracteres; sem ela o CLI sai com erro em pt-BR). CLI: `pnpm --filter @arenaz/api demo:seed` lê `.env` como o `start`, exige `DATABASE_URL` terminando em `/arenaz_demo`, cria o banco (`CREATE DATABASE`) e roda as migrations se ainda não existir.
- [ ] **Step 4: Run** o teste → PASS. Depois rode de verdade contra o Postgres local: `DATABASE_URL=postgres://arenaz:arenaz@localhost:5433/arenaz_demo DEMO_PASSWORD=<gerada> pnpm --filter @arenaz/api demo:seed` e confira `select slug from venue` (13 linhas) e que as fotos abrem em `http://localhost:9000/arenaz-photos/<key>`. Escreva a senha gerada só em `infra/demo/.env.demo` (git-ignored; confira `.gitignore`) — nunca no repositório nem no relatório.
- [ ] **Step 5: Commit** `feat(demo): seed com os espaços e fotos do protótipo`.

### Task 2: API — próximo horário livre e filtros de busca

**Files:**
- Modify: `packages/contracts/src/public-venue.ts` (+ teste), `apps/api/src/public/public-venues.service.ts` (+ teste de integração existente da busca)
- Create (se precisar): `apps/api/src/public/next-free.ts` + teste unitário

**Interfaces:**
- Consumes: `daySlots`, `localDateOf`, `localMinuteOf`, `addDays` de `@arenaz/booking-core`; `loadBusy` de `apps/api/src/booking/busy.ts`.
- Produces: `nextFreeTime`, `amenities`, `maxPrice` (ver Shared Interfaces).

- [ ] **Step 1: Write failing tests**: contrato aceita/recusa `amenities` (valor fora de `AMENITIES` → "Comodidade inválida") e `maxPrice` (0, -1, 10001, "abc" → "Preço máximo inválido"); integração: espaço aberto 07:00–24:00 com `now` = hoje 19:10 no fuso e reserva confirmada 19:30–21:00 → `nextFreeTime === "21:00"` (primeiro início de slot livre ≥ now arredondado para cima ao slot de 30 min, em qualquer quadra ativa, com duração mínima da quadra cabendo antes do fechamento); tudo ocupado ou fechado hoje → `null`; `now` 23:40 com fechamento 24:00 e mínimo de 60 min → `null`; bloqueio (`availability_block`) também ocupa; `amenities=coberta,vestiario` só devolve quem tem as duas; `maxPrice=150` exclui `minPriceCentsPerHour` 18000.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: calcule `nextFreeTime` em lote para a página de resultados (uma consulta de ocupação para todas as quadras da página, não N+1); use o relógio do banco (`clock_timestamp()`/`dbNow`) como os caminhos de reserva. Filtros em SQL.
- [ ] **Step 4: Run** testes da API e contratos → PASS.
- [ ] **Step 5: Commit** `feat(api): próximo horário livre e filtros de comodidade e preço na busca`.

### Task 3: Modo demo e componentes base

**Files:**
- Create: `apps/web/src/lib/demo/index.ts`, `apps/web/src/lib/demo/fixtures.ts` (+ teste), `apps/web/public/esportes/*.jpg` (miniaturas 128×128 das fotos de esporte de `Main.dc.html` `cats`)
- Modify: `packages/ui/src/theme.css` (utilitários `.az-glass`, `.az-lift`, sombras `--shadow-1..3`, `--ease-out`, raios), `packages/ui/src/venue-card.tsx` (+ teste), `packages/ui/src/site-footer.tsx`, `packages/ui/src/index.ts`, `apps/web/src/lib/public-api.ts` (repasse dos novos campos/params), `.env.example` (`NEXT_PUBLIC_DEMO_MODE`)

**Interfaces:**
- Produces: `isDemoMode`, `demoVenueExtras`, `demoOpenGames`, `demoOwnerStats` (Shared Interfaces). `VenueCard` props: `{ href, name, imageUrl, imageAlt, meta, priceCents, nextFreeTime?: string | null, rating?: string, badge?: string, favorite?: { pressed: boolean; onToggle(): void } }` — selo vidro "Livre às 20h" (ponto `--color-free`) só com `nextFreeTime`; nota "★ 4,92" só com `rating`; coração só com `favorite`; foto 20/19 raio 20 px, lift 4–6 px no hover, escala 1.05 na foto, como os cards de `Main.dc.html`.

- [ ] **Step 1: Write failing tests**: `demoVenueExtras('arena-vila-madalena')` devolve nota "4,92" e 318 avaliações com o modo ligado e `null` desligado (mock de `process.env` via `vi.stubEnv`); `VenueCard` sem `nextFreeTime`/`rating`/`favorite` não renderiza selo, nota nem botão; com `favorite` o botão tem `aria-pressed` e nome "Salvar nos favoritos"/"Remover dos favoritos"; "Livre às 19h30" formata `19:30` → "19h30" e `20:00` → "20h".
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Fixtures copiam os números do protótipo (notas e avaliações de `Main`/`Busca`/`Quadra`, as avaliações de Rafael e Camila, sub-notas Gramado/Iluminação/Vestiário/Pontualidade, partidas abertas do `games` de `Main`/`MobileHome`, `Repasse de sexta R$ 3.120`, `12 times`). Favoritos no modo demo: estado só em memória.
- [ ] **Step 4: Run** testes de `ui` e `web` → PASS. **Step 5: Commit** `feat(web): modo demo e card de espaço do protótipo`.

### Task 4: Home desktop e mobile

**Files:**
- Modify: `apps/web/src/app/(public)/page.tsx`, `packages/ui/src/search-bar.tsx`, `packages/ui/src/site-header.tsx`, `apps/web/src/components/layout/public-tab-bar.tsx` (+ testes existentes)
- Create: componentes da home em `apps/web/src/components/home/` (hero, esportes, carrossel, faixa "Falta gente", banner do dono) + testes

**Interfaces:** Consumes Task 2 (`nextFreeTime`) e Task 3 (`VenueCard`, demo).

- [ ] **Step 1: Write failing tests** (Testing Library): a home renderiza "Bora jogar hoje à noite?"; esportes como botões com miniatura e `aria-pressed`, que trocam o carrossel; carrossel "Livre hoje à noite" com cards da API (com selo quando houver `nextFreeTime`); "Areia, raquete e sol pro fim de semana" com espaços de `beach_tennis`/`futevolei`/`volei_praia`/`padel`/`tenis`; "Falta gente? Entra no jogo." só no modo demo; banner "Quadra vazia às 15h também paga as contas." sempre; busca com Onde/Quando/Esporte/Jogadores — submit vai para `/buscar` com `q`, `sport`, `data` (YYYY-MM-DD) e `jogadores`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** seguindo `Main.dc.html` (desktop) e `MobileHome.dc.html` (≤ 760 px: "Bora jogar?", card grande "Livre agora perto de você" com os 3 próximos horários, "Falta gente" no demo, tab bar). Hero noturno com foto `hero-night` (copie de `infra/demo/photos` para `apps/web/public/home/`), parallax sutil só sem `prefers-reduced-motion`. Contadores de marketing ("312 quadras livres") só no demo.
- [ ] **Step 4: Run** testes web + `pnpm --filter @arenaz/web e2e` das specs que tocam a home → PASS. Compare screenshots Playwright 1440×900 e 375×812 com a tela do protótipo e anote no relatório as diferenças que restaram e por quê.
- [ ] **Step 5: Commit** `feat(web): home do protótipo (desktop e mobile)`.

### Task 5: Busca com mapa

**Files:** Modify `apps/web/src/app/(public)/buscar/page.tsx`, `apps/web/src/components/public/{results-list,results-map,map-pin}.tsx`, `apps/web/src/lib/search-query.ts` (+ testes). Create preview flutuante em `apps/web/src/components/public/map-preview.tsx` + teste.

- [ ] **Step 1: Write failing tests**: chips "Coberta", "Vestiário", "Estacionamento", "Até R$ 200/h" com `aria-pressed` que mudam a URL (`amenities`, `maxPrice`) e a lista; "Reserva instantânea" e "Aceita mensalista" só no modo demo e desabilitados com dica "Em breve" (não fingem filtrar); pino com "R$ 180" e nome acessível "Arena Vila Madalena, R$ 180 por hora"; selecionar card ou pino escurece o pino e abre o preview com foto, nome, nota (demo) e "R$ 180 / hora · próximo às 20h"; contador "N quadras com horário livre hoje" usa `nextFreeTime`.
- [ ] **Step 2–4:** FAIL → implementar conforme `Busca.dc.html` → PASS (unit + e2e de busca) + screenshots comparados.
- [ ] **Step 5: Commit** `feat(web): busca com mapa do protótipo`.

### Task 6: Página da quadra

**Files:** Modify `apps/web/src/app/(public)/espacos/[slug]/page.tsx`, `apps/web/src/components/public/{venue-details,booking-card,court-list}.tsx`, `apps/web/src/components/booking/slot-picker.tsx`, `packages/ui/src/gallery.tsx` (+ testes).

- [ ] **Step 1: Write failing tests**: galeria em grade de 5 (1 grande + 4) com "Mostrar todas as fotos" abrindo o lightbox existente; com 1–4 fotos a grade se ajusta sem buracos; título, linha "Society 7x7 em Vila Madalena, São Paulo" e detalhes reais da quadra; nota/avaliações/"Uma das mais bem avaliadas"/avaliações de Rafael e Camila só no demo; "Dono: Marcos" real, "Dono destaque" só no demo; destaques: "Reserva instantânea" sempre, "Racha no Pix" e "Aceita mensalista" só no demo; seletor de dia 64×68 px com dia da semana e número; slots com "R$ 220 · nobre" (cor `#9A4A00`) quando o preço do slot passa do base, "Ocupado" riscado e desabilitado; card de reserva com "R$ 180 / hora fora de pico", Quando, Jogadores (stepper 2–30, inicial de `?jogadores` ou 14), "Dividir com o time" (switch) e "Por pessoa (14)" = total ÷ jogadores — sem taxa de serviço.
- [ ] **Step 2–4:** FAIL → implementar conforme `Quadra.dc.html` mantendo toda a lógica de seleção do Plano 3 (atravessar meia-noite, bloco mínimo) → PASS (unit + `e2e/booking.spec.ts`) + screenshots.
- [ ] **Step 5: Commit** `feat(web): página da quadra do protótipo`.

### Task 7: Checkout e reserva

**Files:** Modify `apps/web/src/app/(account)/reservas/[id]/page.tsx`, `apps/web/src/components/booking/{booking-summary,pix-payment,booking-status,countdown}.tsx` (+ testes).

- [ ] **Step 1: Write failing tests**: estado "Confirmar e pagar" com espaço, "Qua, 28 out · 20:00–22:00", quadra e jogadores, linhas de preço reais, Total, texto de cancelamento grátis até 24h antes com data/hora; estado Pix com "Pague com Pix", "Seu horário está reservado por" + contagem, QR, "Copiar código" e "Aguardando pagamento…"; estado confirmado "Quadra garantida." com endereço e telefone (já real); "Racha do time" com lista e "x de 14 pagaram" só no demo.
- [ ] **Step 2–4:** FAIL → implementar conforme `Checkout.dc.html` (mobile primeiro; no desktop, coluna central de até 480 px) → PASS (unit + `e2e/booking.spec.ts`) + screenshots.
- [ ] **Step 5: Commit** `feat(web): checkout do protótipo`.

### Task 8: Painel do dono

**Files:** Modify `apps/web/src/app/painel/layout.tsx`, `apps/web/src/app/painel/espacos/[id]/agenda/page.tsx`, `apps/web/src/components/owner/{owner-nav,agenda-view,agenda-grid,booking-detail}.tsx`; API: `GET /api/owner/venues/:id/summary?date=YYYY-MM-DD` em `apps/api/src/owner-agenda/` + contrato em `packages/contracts/src/agenda.ts` (+ testes).

**Interfaces:** Produces `ownerVenueSummarySchema = { occupancyPct: number (0–100, inteiro), weekRevenueCents: number }` — ocupação = minutos reservados (`held`+`confirmed`) ÷ minutos abertos do dia em todas as quadras ativas; receita = soma de `total_cents` das reservas `confirmed` de origem `app` com início na semana (seg–dom) da data, no fuso do espaço.

- [ ] **Step 1: Write failing tests**: API (dono só vê o próprio espaço → 404 caso contrário; números acima); web: sidebar com "DONO", saudação "Boa noite, Marcos" (Bom dia/Boa tarde/Boa noite pelo horário do espaço), indicadores "Ocupação hoje" e "Recebido na semana" reais, "Repasse de sexta" e "Mensalistas ativos" só no demo; agenda colorida por tipo com legenda só dos tipos que existem ("Pelo app", "Manual"; "Mensalista"/"Partida aberta" só no demo e sem itens); detalhe da reserva ao selecionar.
- [ ] **Step 2–4:** FAIL → implementar conforme `Painel.dc.html`, mantendo as ações do Plano 3 (bloquear, reserva manual, cancelar) → PASS (unit, API, e2e do painel) + screenshots.
- [ ] **Step 5: Commit** `feat(painel): painel do dono do protótipo`.

### Task 9: Verificação completa e ambiente de demonstração

- [ ] **Step 1:** `pnpm install --frozen-lockfile`; `pnpm turbo run lint typecheck test build --concurrency=2 --force`; `pnpm db:migrate`; e2e completo com as portas das Global Constraints. Tudo verde.
- [ ] **Step 2:** Screenshots finais 1440×900 e 375×812 das 6 telas no banco demo com `NEXT_PUBLIC_DEMO_MODE=true`, lado a lado com o protótipo, salvos em `.superpowers/sdd/<workspace>/screens/`; lista do que ficou diferente de propósito.
- [ ] **Step 3:** Commit só se houver ajuste (`fix(...)`).
