# ArenaZ v2 — Design system e telas do jogador (Plano 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogador encontra espaços publicados (home, busca com mapa) e abre a página do espaço, no visual do protótipo aprovado, com dados reais.

**Architecture:** API pública de leitura (`/api/venues`, sem login) sobre as tabelas do Plano 1, com busca por texto (cidade/bairro, `unaccent`) ou por raio (PostGIS). `packages/ui` ganha os componentes compostos (cabeçalho, rodapé, tab bar, card de espaço, galeria, barra de busca, mapa com preço no pino). As telas são server components do Next com SEO (metadata, OpenGraph, JSON-LD, sitemap). O que depende de reservas/pagamentos/avaliações **não aparece** (sem dado falso): "Livre às", seletor de horário, racha, "Falta gente", notas.

**Tech Stack:** o dos Planos 0–1 (Leaflet já instalado) + `@axe-core/playwright` para checagem de acessibilidade no e2e.

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md` (§1, §3 "Escalabilidade" item 3, §4, §4.1, §5 Plano 2). Visual: `docs/design/prototipo-v2.md` + `docs/design/prototipo/{Main,Busca,Quadra,MobileHome}.dc.html` (copiar copy/estrutura/valores, não importar). Base: Plano 1 (`docs/superpowers/plans/2026-10-29-arenaz-v2-owner-domain.md`).

## Global Constraints

- Tudo dos Planos 0–1 vale (versões estáveis, `strict`, TS 6.x, pt-BR, `problem+json`, centavos, `timestamptz`, recurso de outro dono → 404, WCAG 2.2 AA, mobile-first).
- Visual: só tokens/fontes/logo de `docs/design/prototipo-v2.md` (+ `--color-line-control` do Plano 1); logo atual; respeitar `prefers-reduced-motion`; hover sobe 4–6px e aumenta sombra; foto escala 1.05.
- Rotas públicas sem login: `/`, `/buscar`, `/espacos/[slug]`. Dados públicos **nunca** expõem telefone, rua, número, complemento, CEP nem coordenada exata (a localização pública é arredondada a 2 casas decimais ≈ 1 km — "O endereço exato aparece depois da reserva").
- Só espaços `published` aparecem; quadras inativas não contam para preço nem esportes.
- Nada de dado inventado: sem avaliações, "Livre às", racha, mensalista ou "Falta gente" até os planos que os criam.
- Fotos do protótipo (Unsplash) não entram no repositório; miniaturas de esporte usam tiles com tokens.

## Review Focus

1. **Vazamento de dado privado na API pública** (telefone, endereço, coordenada exata, espaço em rascunho, quadra inativa) → nunca aparece. Testes na Task 1.
2. **Busca sem acento/maiúscula** ("sao paulo", "VILA MADALENA") → encontra "São Paulo"/"Vila Madalena". Teste na Task 1.
3. **Parâmetros de busca inválidos ou hostis** (raio 10000 km, lat 999, página -1, `sport=xyz`, texto de 500 chars) → 422 com campo, não 500 nem consulta cara. Teste na Task 1.
4. **Teclado e leitor de tela na galeria/lightbox e no mapa** (Esc fecha, foco volta ao botão, setas navegam; pinos alcançáveis por Tab ou lista equivalente) → Testes nas Tasks 3 e 5.
5. **Página de espaço despublicado ou slug inexistente** → 404 pt-BR (não 500, não página vazia), e sem indexação. Teste na Task 6.

---

## Mapa de arquivos

```
packages/contracts/src/  public-venue.ts (+ test)
packages/db/migrations/  0004_unaccent.sql (extensão unaccent + função imutável f_unaccent + índices)
apps/api/src/public/     public-venues.controller.ts, public-venues.service.ts, public-venues.module.ts
apps/api/test/           public-venues.e2e.test.ts
packages/ui/src/         site-header.tsx, site-footer.tsx, tab-bar.tsx, chip.tsx, price-tag.tsx, venue-card.tsx,
                         skeleton.tsx, empty-state.tsx, gallery.tsx, lightbox.tsx, search-bar.tsx (+ testes)
apps/web/src/app/        page.tsx (home), buscar/page.tsx, espacos/[slug]/page.tsx, sitemap.ts, robots.ts,
                         (public)/layout.tsx
apps/web/src/components/public/  results-map.tsx, results-list.tsx, venue-details.tsx, booking-card.tsx (+ testes)
apps/web/src/lib/        public-api.ts (+ test)
apps/web/e2e/            player.spec.ts
```

---

### Task 1: API pública de espaços

**Files:**
- Create: `packages/contracts/src/public-venue.ts` (+ test), `packages/db/migrations/0004_unaccent.sql` (custom), `apps/api/src/public/{public-venues.controller,public-venues.service,public-venues.module}.ts`, `apps/api/test/public-venues.e2e.test.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/app.module.ts`

**Interfaces:**
- Produces (contracts):
  - `publicSearchQuerySchema` (query string → valores): `{ q?: string (trim, 2–80), sport?: Sport, lat?: number, lng?: number (ambos ou nenhum; bbox do Brasil), radiusKm: 1..50 (default 10), page: int ≥1 ≤50 (default 1) }`; mensagens pt-BR; `lat`/`lng` chegam como string e são coeridos.
  - `publicVenueCardSchema = { slug, name, neighborhood, city, state, coverUrl: string|null, sports: Sport[], minPriceCentsPerHour: number, approxLocation: {lat,lng}, distanceKm: number|null }`.
  - `publicSearchResponseSchema = { items: PublicVenueCard[], page, pageSize: 20, hasMore: boolean }`.
  - `publicVenueSchema = { slug, name, description: string|null, neighborhood, city, state, approxLocation, amenities, cancellationPolicy, hours, photos: Photo[], host: { firstName: string }, fields: Array<{ id, name, sports, surface, format, lengthM, widthM, minSlotMinutes, basePriceCentsPerHour, priceRules: Array<{ weekdays, startMinute, endMinute, priceCentsPerHour, label }> }> }` — sem telefone, rua, número, complemento, CEP, coordenada exata, ids internos do dono.
- Produces (API, sem `AuthGuard`, rate limit de rota 60/min):
  - `GET /api/venues?…` → `PublicSearchResponse`. Ordem: com `lat/lng` → distância (`ST_Distance` sobre `geography`, filtro `ST_DWithin` com `radiusKm`); com `q` → `f_unaccent(lower(city)) LIKE` ou `f_unaccent(lower(neighborhood)) LIKE` com `%termo%` escapado, ordenado por nome; sem nenhum → mais recentes publicados. `sport` filtra por quadra ativa com aquele esporte. `minPriceCentsPerHour` = menor `base_price_cents_per_hour` entre quadras ativas (faixas de preço não entram no "a partir de"). Espaço sem quadra ativa não aparece. Paginação por `LIMIT 21 OFFSET` (o 21º só define `hasMore`).
  - `GET /api/venues/:slug` → `PublicVenue` só se `published`; senão 404 `detail: "Espaço não encontrado"`. Só quadras ativas.
  - `approxLocation` = lat/lng arredondados a 2 casas.
- Migration `0004`: `CREATE EXTENSION IF NOT EXISTS unaccent;` + função `f_unaccent(text)` `IMMUTABLE` (wrapper sobre `unaccent('unaccent', $1)`) + índices de expressão `f_unaccent(lower(city))` e `f_unaccent(lower(neighborhood))` (btree com `text_pattern_ops` não serve para `%x%`; usar `pg_trgm` + GIN **se** couber sem nova dependência de imagem — `pg_trgm` vem no Postgres; decidir e registrar).

- [ ] **Step 1: Testes que falham**

```ts
it("só lista publicados com quadra ativa e sem dado privado", async () => {
  // publicado+ativa (aparece), rascunho (não), publicado só com quadra inativa (não)
  const res = await get("/api/venues?q=madalena");
  expect(res.json().items.map((i) => i.name)).toEqual(["Arena Pública"]);
  const raw = JSON.stringify(res.json());
  for (const s of ["phone", "street", "number", "cep", "complement", "-23.5568"]) expect(raw).not.toContain(s);
});
it.each(["sao paulo", "VILA MADALENA", "vila  madalena "])("busca sem acento: %s", async (q) => { /* encontra */ });
it("ordena por distância com raio", async () => { /* 2 espaços a 1 km e 8 km; radiusKm=5 → só o de 1 km, distanceKm≈1 */ });
it.each([["radiusKm=10000"], ["lat=999&lng=0"], ["lat=-23.5"], ["page=-1"], ["sport=xyz"], ["q=" + "a".repeat(500)]])(
  "parâmetro inválido %s → 422", async (qs) => { /* … */ });
it("detalhe público: 200 publicado, 404 rascunho e slug inexistente; sem dados privados", async () => { /* … */ });
it("minPrice ignora quadra inativa e faixa de preço", async () => { /* … */ });
it("termo com % e _ é escapado", async () => { /* q=%25 não lista tudo */ });
```

- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm --filter @arenaz/api test`, `pnpm --filter @arenaz/db test`).
- [ ] **Step 5: Commit** — `feat(api): public venue search and detail`.

---

### Task 2: `packages/ui` — layout e cards

**Files:**
- Create: `packages/ui/src/{site-header,site-footer,tab-bar,chip,price-tag,venue-card,skeleton,empty-state}.tsx` (+ testes)
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `SiteHeader({ user: { name } | null, children? /* slot da busca compacta */ })`: logo (link "/"), link "Anuncie sua quadra" (→ `/painel`), avatar com iniciais do usuário (link `/conta`) ou "Entrar". Sticky, fundo branco, `--color-line` embaixo.
- `SiteFooter()`: "© {ano} ArenaZ" e os itens "Termos", "Privacidade (LGPD)", "Ajuda" como **texto simples** (as páginas ainda não existem; nada de `href="#"`).
- `TabBar({ active: "inicio"|"buscar"|"conta" })`: só < 768px (`md:hidden`), fixa embaixo, 3 itens com ícone SVG inline + rótulo ("Início", "Buscar", "Conta"), `aria-current="page"` no ativo.
- `Chip({ pressed?, onClick?, href?, children })`: pílula raio 999px; `aria-pressed` quando toggle.
- `PriceTag({ cents, suffix = "/ hora", from?: boolean })`: "a partir de R$ 180 / hora" (sem centavos quando inteiro: `R$ 180`; com: `R$ 180,50`).
- `VenueCard({ href, name, neighborhood, city, coverUrl, sports, minPriceCentsPerHour, distanceKm? })`: foto quadrada raio 20px (`--shadow-1`, hover sobe 4px + `--shadow-2`, foto escala 1.05, tudo `motion-reduce:` desligado), sem foto → tile neutro com o ícone do logo; título, "Bairro, Cidade", esportes (`SPORT_LABELS` unidos por " · "), `PriceTag from`, "1,2 km" quando houver distância. O card inteiro é um link (um só `<a>`; nada interativo dentro).
- `Skeleton({ className })`, `EmptyState({ title, description?, action? })`.

- [ ] **Step 1: Testes que falham** — `PriceTag` formata 18000 → "R$ 180", 18050 → "R$ 180,50", com "a partir de"; `VenueCard` é um único link com nome acessível = nome do espaço, `img alt=""` (decorativa, o nome já está no link) e fallback sem foto; `TabBar` marca `aria-current`; `Chip` toggle alterna `aria-pressed`; `SiteHeader` mostra iniciais "GR" para "Gabriel Ribeiro" e "Entrar" sem usuário.
- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm --filter @arenaz/ui test`).
- [ ] **Step 5: Commit** — `feat(ui): site chrome, chips, price tag and venue card`.

---

### Task 3: `packages/ui` — galeria, lightbox e barra de busca

**Files:**
- Create: `packages/ui/src/{gallery,lightbox,search-bar}.tsx` (+ testes)

**Interfaces:**
- `Gallery({ photos: {url, alt}[] })`: até 5 fotos no grid do protótipo (1 grande + 4 pequenas, raio 20px no conjunto); botão "Mostrar todas as fotos" abre `Lightbox` no índice 0; clicar numa foto abre no índice dela (cada foto é um `<button>` com nome "Abrir foto N de M"). 0 fotos → não renderiza; 1–4 → grade adaptada.
- `Lightbox({ photos, index, onClose })`: `<dialog>` nativo com `showModal()`; Esc fecha; setas ←/→ e botões "Foto anterior"/"Próxima foto"; contador "3 de 8" (`aria-live="polite"`); foco vai para o botão "Fechar" ao abrir e volta ao elemento que abriu ao fechar; fundo `--color-night`.
- `SearchBar({ defaultQuery?, defaultSport?, action = "/buscar" })`: `<form method="get">` (funciona sem JS) em pílula (`--shadow-3`, raio 999px no desktop; empilhado no mobile) com campos "Onde" (`name="q"`, placeholder "Cidade ou bairro"), "Esporte" (`select name="sport"`, "Qualquer esporte" + `SPORT_LABELS`) e botão "Buscar"; botão secundário "Perto de mim" que, com JS, usa `navigator.geolocation` e navega para `/buscar?lat=…&lng=…` (coordenadas com 3 casas); sem permissão → mensagem "Não conseguimos sua localização" no `Alert`.

- [ ] **Step 1: Testes que falham** — Lightbox: abre com foco em "Fechar", → avança e anuncia "2 de 3", Esc fecha e devolve o foco ao botão de origem; Gallery com 1 foto não mostra grade de 5; SearchBar envia `q` e `sport` (GET) e "Perto de mim" monta a URL com 3 casas (geolocation mockado) e mostra erro quando negado.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(ui): gallery, lightbox and search bar`.

---

### Task 4: Home

**Files:**
- Create: `apps/web/src/lib/public-api.ts` (+ test), `apps/web/src/app/(public)/layout.tsx`
- Modify: `apps/web/src/app/page.tsx` (move para `(public)/page.tsx`), `apps/web/src/app/layout.tsx` (metadata base)

**Interfaces:**
- `publicGet<T>(path, schema, { revalidate = 60 })`: fetch server-side **sem cookie** (dado público, cacheável — `next: { revalidate }`), valida com o schema; 404 → `null`; outros → lança.
- `(public)/layout.tsx`: `SiteHeader` (usuário via `getSession()`, que pode ser `null`), `SiteFooter`, `TabBar`; `<main>` com padding inferior no mobile para a tab bar.
- Home `/` (desktop e mobile, uma página responsiva):
  - Hero noturno (`--color-night`, raio 32–36px) com título "Bora jogar hoje à noite?", subtítulo "Reserve a quadra na hora e chame o time." (sem promessa de racha ainda), `SearchBar` sobreposta ao hero (desktop) / logo abaixo (mobile).
  - "Esportes": `Chip`s-tile para cada `SPORT` com label, link para `/buscar?sport=…`.
  - "Espaços em destaque": até 8 `VenueCard` de `GET /api/venues` (mais recentes), carrossel horizontal com scroll-snap acessível (lista `<ul>` rolável com `tabIndex=0` e `aria-label`); vazio → `EmptyState` "Ainda não há espaços publicados por aqui."
  - Banner do dono: "Para donos de quadra" / "Quadra vazia às 15h também paga as contas." / botão "Anunciar minha quadra" → `/painel`.
  - `metadata`: title "ArenaZ — reserve quadras perto de você", description, OpenGraph básico.

- [ ] **Step 1: Testes que falham** — `publicGet` não envia cookie, 404 → `null`; Home renderiza hero, chips com hrefs corretos, cards a partir de dados mockados e o vazio.
- [ ] **Step 2–4:** falhar → implementar → passar; `next build`.
- [ ] **Step 5: Commit** — `feat(web): public home with featured venues`.

---

### Task 5: Busca com mapa

**Files:**
- Create: `apps/web/src/app/(public)/buscar/page.tsx`, `apps/web/src/components/public/{results-list,results-map,map-pin}.tsx` (+ testes)

**Interfaces:**
- `/buscar` (server): lê `q`, `sport`, `lat`, `lng`, `page` da URL, valida com `publicSearchQuerySchema` (inválido → mostra a mensagem do campo e a busca vazia, sem 500), chama a API, renderiza `SearchBar` compacta (valores atuais), contagem ("12 espaços" / "1 espaço"), lista e mapa; "Carregar mais" é um link para `page+1` (funciona sem JS).
- Layout: desktop = grade de cards à esquerda + mapa fixo à direita (sticky, raio 24px); mobile = lista, com botão flutuante "Mapa"/"Lista" alternando (`aria-pressed`).
- `ResultsMap({ items, selectedSlug, onSelect })` (client, Leaflet via `next/dynamic` sem SSR): pino = etiqueta com preço ("R$ 180") via `divIcon` (fundo branco, `--shadow-1`; selecionado: fundo `--color-ink`, texto branco); enquadra os resultados (`fitBounds`); clicar no pino mostra preview flutuante (`VenueCard` compacto) com link; o mapa inteiro tem `aria-label="Mapa dos resultados"` e os pinos **não** são o único caminho — a lista é a alternativa acessível; passar o mouse/focar um card destaca o pino (`selectedSlug`).
- Sem resultados → `EmptyState` "Nenhum espaço encontrado" + link "Ver todos os espaços" (`/buscar`).
- `metadata` dinâmica: "Quadras em {q}" quando houver `q`.

- [ ] **Step 1: Testes que falham** — página com `sport=xyz` mostra "Esporte inválido" e não chama a API; contagem singular/plural; "Carregar mais" só com `hasMore` e com o `page+1` preservando filtros; foco/hover no card seleciona o pino (mapa mockado recebe `selectedSlug`); toggle mobile alterna `aria-pressed`.
- [ ] **Step 2–4:** falhar → implementar → passar; `next build`.
- [ ] **Step 5: Commit** — `feat(web): search page with price-pin map`.

---

### Task 6: Página do espaço

**Files:**
- Create: `apps/web/src/app/(public)/espacos/[slug]/page.tsx`, `apps/web/src/components/public/{venue-details,court-list,booking-card}.tsx` (+ testes)

**Interfaces:**
- `/espacos/[slug]` (server, `revalidate: 60`): `publicGet` → `null` → `notFound()` (a página 404 pt-BR do Plano 1).
- Conteúdo (estrutura do `Quadra.dc.html`, sem o que não existe ainda): título (nome), linha "Bairro, Cidade · UF", botão "Compartilhar" (Web Share API; fallback copia o link e mostra "Link copiado"), `Gallery`, descrição, "Comodidades" (ícone + `AMENITY_LABELS`), "Quadras" (`CourtList`: nome, esportes, piso, formato, medidas "40 × 20 m", duração mínima, `PriceTag` base e faixas resumidas — "Sex e Sáb, 18h–23h: R$ 250 / hora"), "Horário de funcionamento" (7 dias, "Fechado" quando ausente), "Política de cancelamento" (label + descrição), "Onde fica" (mapa estático Leaflet não arrastável centrado na `approxLocation` com círculo de ~1 km e o texto "{Bairro}, {Cidade}. O endereço exato aparece depois da reserva."), "Dono: {firstName}".
- `BookingCard` (fixo à direita no desktop, barra inferior no mobile): `PriceTag from` com o menor preço e o texto "Reserva online chega em breve." com botão desabilitado "Escolher horário" (`aria-disabled`, explicação ligada por `aria-describedby`) — o Plano 3 troca pelo seletor.
- SEO: `generateMetadata` (title "{nome} — {Bairro}, {Cidade} | ArenaZ", description, OpenGraph com a capa), JSON-LD `SportsActivityLocation` (nome, `address` só com bairro/cidade/UF, `geo` aproximado, `image`).
- Rascunho/inexistente → 404 com `robots: { index: false }`.

- [ ] **Step 1: Testes que falham** — resumo de faixas ("Sex e Sáb, 18h–23h: R$ 250 / hora"; dias consecutivos "Seg a Sex"); horário com dia fechado; JSON-LD não contém rua/telefone; "Compartilhar" usa `navigator.share` quando existe e copia quando não; `notFound()` para `null`.
- [ ] **Step 2–4:** falhar → implementar → passar; `next build`.
- [ ] **Step 5: Commit** — `feat(web): public venue page with gallery, courts and seo`.

---

### Task 7: Painel no design system, sitemap e robots

**Files:**
- Create: `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`
- Modify: `apps/web/src/app/painel/layout.tsx` (usa `SiteHeader` com selo "DONO" e link "Ver página pública" quando publicado), `apps/web/src/app/painel/page.tsx` (cards do dono no estilo `VenueCard`), páginas do painel com `metadata.robots = { index: false }`, `apps/web/src/app/(auth)/*` e `/conta` (usam o layout público ou o `PageShell` restilizado — consistência visual)

**Interfaces:**
- `sitemap.ts`: `/`, `/buscar` e cada `/espacos/{slug}` publicado (pagina `GET /api/venues` até 50 páginas; `lastModified` não exposto → omitir). `NEXT_PUBLIC_SITE_URL` (novo env, default `http://localhost:3000`) como base.
- `robots.ts`: permite tudo exceto `/painel`, `/conta`, `/entrar`, `/cadastro`; aponta o sitemap.

- [ ] **Step 1: Testes que falham** — sitemap lista só publicados (API mockada) e para em `hasMore=false`; robots bloqueia `/painel`; layout do painel mostra "DONO" e o link público só para espaço publicado.
- [ ] **Step 2–4:** falhar → implementar → passar; `next build`.
- [ ] **Step 5: Commit** — `feat(web): owner panel on the design system; sitemap and robots`.

---

### Task 8: E2E do jogador e acessibilidade

**Files:**
- Create: `apps/web/e2e/player.spec.ts`
- Modify: `apps/web/package.json` (`@axe-core/playwright`), `apps/web/e2e/playwright.config.ts` (se preciso)

- [ ] **Step 1: Teste e2e**

```ts
test("jogador encontra e abre um espaço publicado", async ({ page }) => {
  // pré-condição: dono cria e publica espaço via API (helper que usa o request context com cookie) em CEP 05435000
  // jogador anônimo: "/" → SearchBar "vila madalena" + Society → /buscar?q=… → card do espaço → /espacos/<slug>
  // vê nome, "Quadras", preço "a partir de", "O endereço exato aparece depois da reserva."; NÃO vê "100" (número) nem telefone
});
test("rascunho dá 404", async ({ page }) => { /* /espacos/<slug de rascunho> → "Página não encontrada" */ });
test("sem violações de acessibilidade graves", async ({ page }) => {
  // AxeBuilder em "/", "/buscar", "/espacos/<slug>" → 0 violações "serious"/"critical" (excluir o container do mapa Leaflet se acusar algo do próprio Leaflet, registrando)
});
```

- [ ] **Step 2: Rodar** — `pnpm db:up && pnpm e2e` → 7 passed (4 anteriores + 3).
- [ ] **Step 3: Verificar** — `pnpm turbo run lint typecheck test build` verde.
- [ ] **Step 4: Commit** — `test(e2e): player discovery flow and axe checks`.

---

## Definição de pronto do Plano 2

- Visitante sem login encontra espaços publicados pela home e pela busca (texto ou "Perto de mim"), vê no mapa e abre a página do espaço; nada privado vaza.
- Os 5 itens do *Review Focus* têm teste passando; `axe` sem violações sérias nas 3 telas.
- `pnpm turbo run lint typecheck test build` e `pnpm e2e` verdes; `dev/redesign` atualizado no remoto.
- Próximo: Plano 3 (motor de reservas) — começa pela migration de fuso do espaço, turnos/madrugada, CHECKs de `price_rule`, bounds de `tstzrange` e EXCLUDE (decisões registradas no fim do Plano 1).
