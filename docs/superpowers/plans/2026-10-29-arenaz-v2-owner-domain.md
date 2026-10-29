# ArenaZ v2 — Domínio do dono (Plano 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono cadastra o espaço (venue), as quadras (fields), faixas de preço, bloqueios e fotos pelo painel `/painel`, e publica o espaço.

**Architecture:** Novas tabelas no `packages/db` (PostGIS `geography(Point,4326)` para localização). Schemas de entrada/saída em `packages/contracts`. Módulos Nest em `apps/api` sob `/api/owner/*`, todos atrás do `AuthGuard`; quem cria um venue é o dono dele. Fotos vão do navegador direto para o object storage por *presigned POST* (MinIO local, S3/R2 em produção); a API só emite a URL e confirma o objeto. `packages/ui` nasce aqui com as primitivas de formulário (puxado do Plano 2, que constrói as telas compostas em cima delas).

**Tech Stack:** o do Plano 0 + `@aws-sdk/client-s3`, `@aws-sdk/s3-post-presigner`, MinIO (compose + Testcontainers `GenericContainer`), Leaflet/react-leaflet (mapa do pino), ViaCEP + Nominatim (consulta de CEP, server-side).

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md` (§3 "Modelo de domínio", "Escalabilidade" itens 3 e 5, §4, §4.1). Visual: `docs/design/prototipo-v2.md`. Base: Plano 0 (`docs/superpowers/plans/2026-10-28-arenaz-v2-foundation.md`).

## Global Constraints

- Tudo do Plano 0 continua valendo (versões estáveis via `pnpm view`, nunca `latest`/`*`; `strict`; TypeScript 6.x; pt-BR na interface; `application/problem+json`; sem `any`/`@ts-ignore`/`eslint-disable` sem justificativa).
- Dinheiro inteiro em centavos BRL (`*_cents`), nunca float; datas `timestamptz` UTC; exibição em `America/Sao_Paulo`.
- Geo nativo: `location geography(Point,4326)` + índice GiST.
- Fotos em object storage com upload direto por URL assinada; **a API nunca trafega bytes de imagem**.
- Acessibilidade WCAG 2.2 AA; mobile-first.
- Visual: só tokens/fontes/logo de `docs/design/prototipo-v2.md`; logo atual.
- Branch de trabalho: `dev/redesign` (commits diretos, push ao fim do plano revisado).
- Recursos de outro dono respondem **404** (nunca 403) para não revelar existência.

## Review Focus

1. **Dono A mexendo em recurso do dono B** (venue, field, foto, bloqueio, faixa) → 404 `problem+json`, sem alterar nada. Testes nas Tasks 3, 4 e 5.
2. **Faixas de preço sobrepostas** no mesmo dia, ou horário fora de múltiplos de 30 min → 422 com mensagem pt-BR no campo. Testes nas Tasks 1 e 4.
3. **Confirmação de foto adulterada** (chave fora do prefixo do venue, objeto inexistente, tipo/tamanho fora do permitido) → 422, sem registro criado. Teste na Task 5.
4. **Preço digitado como "R$ 1.234,50"** no painel → 123450 centavos; valor inválido não envia. Testes nas Tasks 1 e 9.
5. **Publicar espaço incompleto** (sem horário, sem quadra ativa ou sem foto) → 422 listando o que falta em pt-BR. Teste na Task 3.

---

## Mapa de arquivos

```
packages/contracts/src/  catalog.ts, money.ts, venue.ts, field.ts, photo.ts, geo.ts (+ *.test.ts)
packages/db/src/schema/  venue.ts, field.ts, geography.ts ; migrations/0002_owner_domain.sql
packages/ui/             package.json, src/{theme.css, button.tsx, field.tsx, input.tsx, select.tsx,
                         textarea.tsx, checkbox.tsx, card.tsx, badge.tsx, alert.tsx, index.ts} (+ testes)
apps/api/src/venues/     venues.controller.ts, venues.service.ts, venues.module.ts, slug.ts, owner.ts
apps/api/src/fields/     fields.controller.ts, fields.service.ts, fields.module.ts
apps/api/src/photos/     photos.controller.ts, photos.service.ts, photos.module.ts
apps/api/src/storage/    storage.port.ts, s3.storage.ts, storage.module.ts
apps/api/src/geo/        geo.port.ts, http.geo.ts, fake.geo.ts, geo.controller.ts, geo.module.ts
apps/api/test/           venues.e2e.test.ts, fields.e2e.test.ts, photos.e2e.test.ts, geo.test.ts, helpers.ts
apps/web/src/app/painel/ layout.tsx, page.tsx, espacos/novo/page.tsx, espacos/[id]/page.tsx,
                         espacos/[id]/quadras/novo/page.tsx, quadras/[fieldId]/page.tsx
apps/web/src/components/owner/  venue-form.tsx, hours-editor.tsx, location-picker.tsx, field-form.tsx,
                         price-rules-editor.tsx, blocks-editor.tsx, photo-uploader.tsx (+ testes)
apps/web/src/lib/        api.ts (server fetch com cookie), api-client.ts (mutations no browser)
infra/docker-compose.yml (+ minio), .env.example, .github/workflows/ci.yml, apps/web/e2e/owner.spec.ts
```

---

### Task 1: Contratos do domínio do dono

**Files:**
- Create: `packages/contracts/src/{catalog,money,venue,field,photo,geo}.ts`, testes `*.test.ts` ao lado
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces (exportados de `@arenaz/contracts`):
  - `SPORTS = ["futebol_society","futsal","futebol_campo","beach_tennis","futevolei","volei_praia","padel","tenis"] as const`, `SPORT_LABELS: Record<Sport,string>` ("Society", "Futsal", "Campo", "Beach tennis", "Futevôlei", "Vôlei de praia", "Padel", "Tênis").
  - `SURFACES = ["grama_sintetica","grama_natural","areia","saibro","piso_rigido","madeira"]`, `SURFACE_LABELS`.
  - `FIELD_FORMATS = ["5x5","6x6","7x7","8x8","11x11"]`.
  - `AMENITIES = ["vestiario","chuveiro","estacionamento","iluminacao","bar","churrasqueira","coberta","acessibilidade","wifi","aluguel_material"]`, `AMENITY_LABELS`.
  - `CANCELLATION_POLICIES = ["flexivel","moderada","rigida"]`, `CANCELLATION_POLICY_LABELS` e `CANCELLATION_POLICY_DESCRIPTIONS` ("Reembolso total até 24h antes", "Reembolso total até 48h antes", "Reembolso de 50% até 7 dias antes").
  - `UF = [27 siglas]`, `WEEKDAY_LABELS = ["Domingo",…,"Sábado"]` (0 = domingo).
  - `parseBrlToCents(input: string): number | null` e `formatCents(cents: number): string` (`Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"})`, com NBSP normalizado para espaço comum).
  - `cepSchema` (remove não-dígitos, exige 8; mensagem "CEP inválido") → `"01234567"`.
  - `minuteOfDaySchema` (inteiro 0–1440, múltiplo de 30; mensagem "Use horários em intervalos de 30 minutos").
  - `addressSchema = { cep, street (1–120), number (1–20), complement? (≤60), neighborhood (1–80), city (1–80), state: enum UF }`.
  - `locationSchema = { lat: [-34, 6], lng: [-74, -28] }` (caixa do Brasil; mensagem "Localização fora do Brasil").
  - `venueInputSchema = { name (trim 3–80), description? (≤2000), phone: phoneBrSchema, address, location, amenities: AMENITIES[] únicos, cancellationPolicy }`; `venueUpdateSchema = venueInputSchema.partial()`.
  - `venueHoursSchema = Array<{ weekday 0–6, openMinute, closeMinute }>`: weekdays únicos; `openMinute < closeMinute`; mensagem "O fechamento precisa ser depois da abertura".
  - `venueSchema` (resposta): `{ id, slug, name, description: string|null, phone, address, location, amenities, cancellationPolicy, status: "draft"|"published", hours, photos: PhotoResponse[], fields: FieldResponse[], createdAt, updatedAt }`; `venueSummarySchema` (lista do painel): `{ id, slug, name, status, city, fieldsCount, coverUrl: string|null }`.
  - `fieldInputSchema = { name (2–60), sports: Sport[] (≥1, únicos), surface, format: FIELD_FORMATS|null, lengthM?/widthM? (0 < x ≤ 200), minSlotMinutes: 30|60|90, basePriceCentsPerHour: centsSchema > 0 e ≤ 1_000_000, isActive (default true) }`; `fieldUpdateSchema = partial`.
  - `priceRuleInputSchema = { weekdays: (0–6)[] (≥1, únicos), startMinute, endMinute, priceCentsPerHour (>0), label? (≤40) }`, `start < end`; `priceRulesInputSchema` = array ≤50 cujo refine rejeita sobreposição (mesmo weekday e intervalos que se cruzam, borda encostada não conta) com mensagem "Faixas de preço se sobrepõem" no path `[i]`.
  - `blockInputSchema = { startsAt, endsAt: ISO 8601 com offset, start < end, duração ≤ 90 dias, reason? (≤120) }`.
  - `fieldSchema`/`FieldResponse` (com `priceRules` e `blocks` futuros), `priceRuleSchema`, `blockSchema`.
  - `PHOTO_CONTENT_TYPES = ["image/jpeg","image/png","image/webp"]`, `PHOTO_MAX_BYTES = 10 * 1024 * 1024`, `PHOTO_MAX_PER_VENUE = 20`; `photoUploadRequestSchema = { contentType, size: 1..PHOTO_MAX_BYTES }`; `photoUploadResponseSchema = { url, fields: Record<string,string>, key, expiresAt }`; `photoConfirmSchema = { key }`; `photoOrderSchema = { photoIds: uuid[] }`; `photoSchema = { id, url, position }`.
  - `cepLookupResponseSchema = { cep, street, neighborhood, city, state, location: {lat,lng} | null }`.

- [ ] **Step 1: Testes que falham**

```ts
// money.test.ts
it.each([["R$ 1.234,50", 123450], ["120", 12000], ["120,5", 12050], ["0,99", 99], ["R$120,00", 12000]])(
  "parseBrlToCents(%s) → %i", (raw, cents) => expect(parseBrlToCents(raw)).toBe(cents));
it.each(["", "abc", "12,345", "-5", "1.2.3"])("parseBrlToCents(%s) → null", (raw) =>
  expect(parseBrlToCents(raw)).toBeNull());
it("formatCents", () => expect(formatCents(123450)).toBe("R$ 1.234,50"));
// field.test.ts
it("rejeita faixas sobrepostas no mesmo dia", () => {
  const r = priceRulesInputSchema.safeParse([
    { weekdays: [1, 2], startMinute: 1080, endMinute: 1320, priceCentsPerHour: 20000 },
    { weekdays: [2], startMinute: 1260, endMinute: 1380, priceCentsPerHour: 25000 },
  ]);
  expect(r.success).toBe(false);
  expect(JSON.stringify(r.error?.issues)).toContain("Faixas de preço se sobrepõem");
});
it("aceita faixas encostadas", () => { /* 1080–1260 e 1260–1380 no mesmo dia → success */ });
it("rejeita minuto fora de múltiplo de 30", () => { /* startMinute 1085 → fail */ });
// venue.test.ts
it("normaliza CEP e rejeita localização fora do Brasil", () => { /* "01310-100" → "01310100"; lat 40 → fail */ });
it("rejeita horário com fechamento antes da abertura e dia repetido", () => { /* … */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @arenaz/contracts test` → FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** conforme *Interfaces*. `parseBrlToCents`: aceita prefixo `R$` e espaços, `.` só como separador de milhar em grupos de 3, `,` decimal com 1–2 casas; nada de float (montar inteiro a partir das partes).
- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter @arenaz/contracts test && pnpm --filter @arenaz/contracts build`.
- [ ] **Step 5: Commit** — `feat(contracts): owner domain schemas, catalog and money helpers`.

---

### Task 2: Tabelas do domínio no banco

**Files:**
- Create: `packages/db/src/schema/{geography,venue,field}.ts`, `packages/db/migrations/0002_owner_domain.sql` (gerada por `drizzle-kit generate`, com ajustes manuais só se o drizzle não emitir algo — então registrar no relatório), `packages/db/test/owner-domain.test.ts`
- Modify: `packages/db/src/schema/index.ts`

**Interfaces:**
- Produces (em `schema`): tabelas com colunas **snake_case** (decisão do Plano 1: tabelas de domínio usam snake_case; as do Better Auth ficam como estão):
  - `venue`: `id uuid pk default gen_random_uuid()`, `owner_id text fk user.id on delete cascade`, `slug text unique`, `name`, `description null`, `phone`, `cep`, `street`, `number`, `complement null`, `neighborhood`, `city`, `state char(2)`, `location geography(Point,4326) not null` (índice GiST), `amenities text[] default '{}'`, `cancellation_policy text check in (...)`, `status text check in ('draft','published') default 'draft'`, `created_at`, `updated_at timestamptz`. Índice em `owner_id`.
  - `venue_hours`: `venue_id fk cascade`, `weekday smallint check 0–6`, `open_minute`, `close_minute smallint`, pk (`venue_id`,`weekday`), check `open_minute < close_minute`, múltiplos de 30.
  - `venue_photo`: `id uuid`, `venue_id fk cascade`, `storage_key text unique`, `position smallint`, `created_at`.
  - `field`: `id uuid`, `venue_id fk cascade`, `name`, `sports text[]` (check não vazio), `surface`, `format null`, `length_m numeric(5,1) null`, `width_m numeric(5,1) null`, `min_slot_minutes smallint check in (30,60,90)`, `base_price_cents_per_hour integer check > 0`, `is_active boolean default true`, timestamps.
  - `price_rule`: `id uuid`, `field_id fk cascade`, `weekdays smallint[]`, `start_minute`, `end_minute smallint`, `price_cents_per_hour integer check > 0`, `label null`; check `start_minute < end_minute`.
  - `availability_block`: `id uuid`, `field_id fk cascade`, `period tstzrange not null` (check `not isempty(period)`), `reason null`, `created_at`; índice GiST em `period`.
  - `geography.ts`: `customType` Drizzle para `geography(Point,4326)` com `toDriver({lat,lng})` → `sql\`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography\`` e leitura via `ST_Y/ST_X` nos selects (helper `selectLocation(column)` que devolve `{ lat, lng }`).
  - Tipos inferidos exportados: `Venue`, `NewVenue`, `Field`, `PriceRule`, `AvailabilityBlock`, `VenuePhoto`.

- [ ] **Step 1: Testes que falham** (rodam no Testcontainer existente)

```ts
it("cria as tabelas do domínio", async () => { /* venue, venue_hours, venue_photo, field, price_rule, availability_block existem */ });
it("location é geography e consulta por raio funciona", async () => {
  // insere venue em (-23.5614, -46.6911); ST_DWithin(location, ST_MakePoint(-46.69,-23.56)::geography, 2000) → 1 linha
});
it("rejeita preço zero e slot inválido", async () => { /* insert field com base_price 0 → code 23514; min_slot 45 → 23514 */ });
it("apagar o usuário apaga venues e quadras em cascata", async () => { /* … */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @arenaz/db test`.
- [ ] **Step 3: Implementar** schema + `pnpm --filter @arenaz/db generate --name owner_domain`. Nunca editar `0000`/`0001`.
- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter @arenaz/db test && pnpm --filter @arenaz/db build`; `pnpm db:migrate` contra o compose.
- [ ] **Step 5: Commit** — `feat(db): venue, field, price rule, block and photo tables`.

---

### Task 3: API — venues do dono

**Files:**
- Create: `apps/api/src/venues/{venues.controller,venues.service,venues.module,slug,owner}.ts`, `apps/api/test/{helpers,venues.e2e.test}.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `@CurrentUser()`, `DB`, `ZodPipe` (Plano 0); schemas da Task 1; tabelas da Task 2.
- Produces:
  - `test/helpers.ts`: `buildTestApp(): Promise<NestFastifyApplication>` (o mesmo setup dos e2e existentes) e `signUpAs(app, name): Promise<{ cookie: string; userId: string }>` (e-mail único por chamada). Os testes das Tasks 4–5 usam isso.
  - `slugify(name: string): string` (remove acentos, minúsculas, `[a-z0-9-]`, colapsa hífens, ≤ 60) e `VenuesService.uniqueSlug(name)` (sufixo `-2`, `-3`… se colidir).
  - `owner.ts`: `findOwnedVenue(db, venueId, userId)` e `findOwnedField(db, fieldId, userId)` que lançam `NotFoundException("Espaço não encontrado")` / `("Quadra não encontrada")` quando não existe **ou** é de outro dono. Todas as rotas `/owner/*` usam esses dois.
  - Rotas (prefixo `/api`, todas com `AuthGuard`):
    - `GET /owner/venues` → `VenueSummary[]` do usuário.
    - `POST /owner/venues` (`venueInputSchema`) → 201 `Venue` (`status: "draft"`).
    - `GET /owner/venues/:id` → `Venue` (com `hours`, `photos`, `fields`).
    - `PATCH /owner/venues/:id` (`venueUpdateSchema`) → `Venue`; mudar `name` não muda `slug`.
    - `DELETE /owner/venues/:id` → 204 (apaga objetos das fotos via `StoragePort` quando a Task 5 existir; até lá só o banco — a Task 5 completa).
    - `PUT /owner/venues/:id/hours` (`venueHoursSchema`) → `Venue` (substitui tudo em transação).
    - `POST /owner/venues/:id/publish` → `Venue` publicado, ou 422 `Problem` com `detail: "Complete o espaço antes de publicar"` e `errors: { hours?: ["Defina o horário de funcionamento"], fields?: ["Cadastre ao menos uma quadra ativa"], photos?: ["Envie ao menos uma foto"] }`.
    - `POST /owner/venues/:id/unpublish` → `Venue` em `draft`.
  - Todas as respostas validadas com o schema de resposta antes de sair.

- [ ] **Step 1: Testes que falham** (`venues.e2e.test.ts`)

```ts
it("cria, lista, lê e edita o próprio espaço", async () => { /* POST 201 draft com slug "arena-vila-madalena"; GET lista 1; PATCH name mantém slug */ });
it("slug repetido ganha sufixo", async () => { /* dois "Arena Vila Madalena" → "-2" */ });
it("outro dono recebe 404 em GET, PATCH, DELETE, hours e publish", async () => {
  // A cria; B tenta cada rota → 404 problem+json; GET de A depois mostra nada alterado
});
it("sem login → 401", async () => { /* GET /api/owner/venues */ });
it("publicar incompleto lista o que falta", async () => {
  const res = await post(`/api/owner/venues/${id}/publish`);
  expect(res.statusCode).toBe(422);
  expect(res.json().errors).toEqual({
    hours: ["Defina o horário de funcionamento"],
    fields: ["Cadastre ao menos uma quadra ativa"],
    photos: ["Envie ao menos uma foto"],
  });
});
it("horário substitui o anterior e valida", async () => { /* PUT duas vezes; fechamento antes da abertura → 422 */ });
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @arenaz/api test -- venues`.
- [ ] **Step 3: Implementar.** Publicação conta quadras com `is_active` e fotos direto no banco (a Task 5 cria fotos; o teste do caso "completo" fica na Task 5).
- [ ] **Step 4: Rodar e ver passar** — `pnpm --filter @arenaz/api test && pnpm --filter @arenaz/api typecheck`.
- [ ] **Step 5: Commit** — `feat(api): owner venues CRUD, hours and publish rules`.

---

### Task 4: API — quadras, faixas de preço e bloqueios

**Files:**
- Create: `apps/api/src/fields/{fields.controller,fields.service,fields.module}.ts`, `apps/api/test/fields.e2e.test.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/src/venues/venues.service.ts` (incluir `fields` no `Venue`)

**Interfaces:**
- Consumes: `findOwnedVenue`, `findOwnedField`, `buildTestApp`, `signUpAs` (Task 3); schemas da Task 1.
- Produces (todas com `AuthGuard`):
  - `POST /owner/venues/:venueId/fields` (`fieldInputSchema`) → 201 `Field`.
  - `GET /owner/fields/:id` → `Field` com `priceRules` e `blocks` futuros (ordenados por início).
  - `PATCH /owner/fields/:id` → `Field`; `DELETE /owner/fields/:id` → 204.
  - `PUT /owner/fields/:id/price-rules` (`priceRulesInputSchema`) → `PriceRule[]` (substitui o conjunto em transação).
  - `POST /owner/fields/:id/blocks` (`blockInputSchema`) → 201 `Block`; bloqueio que cruza outro bloqueio da mesma quadra → 409 `detail: "Já existe um bloqueio nesse período"` (checado com `period && tstzrange(...)` na mesma transação).
  - `DELETE /owner/blocks/:id` → 204 (dono via join `field → venue`).

- [ ] **Step 1: Testes que falham**

```ts
it("CRUD de quadra no próprio espaço", async () => { /* create 201; GET; PATCH preço; DELETE 204 */ });
it("faixas sobrepostas → 422 no campo", async () => {
  const res = await put(`/api/owner/fields/${fid}/price-rules`, [
    { weekdays: [5], startMinute: 1080, endMinute: 1320, priceCentsPerHour: 20000 },
    { weekdays: [5, 6], startMinute: 1200, endMinute: 1260, priceCentsPerHour: 30000 },
  ]);
  expect(res.statusCode).toBe(422);
  expect(JSON.stringify(res.json().errors)).toContain("Faixas de preço se sobrepõem");
});
it("bloqueio sobreposto → 409; encostado → 201", async () => { /* … */ });
it("outro dono recebe 404 em quadra, faixas e bloqueios", async () => { /* B em cada rota de A → 404; nada muda */ });
it("preço não inteiro → 422", async () => { /* basePriceCentsPerHour: 100.5 */ });
```

- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm --filter @arenaz/api test`).
- [ ] **Step 5: Commit** — `feat(api): fields, price rules and availability blocks`.

---

### Task 5: Storage e fotos por URL assinada

**Files:**
- Create: `apps/api/src/storage/{storage.port,s3.storage,storage.module}.ts`, `apps/api/src/photos/{photos.controller,photos.service,photos.module}.ts`, `apps/api/test/{photos.e2e.test,minio-setup}.ts`
- Modify: `infra/docker-compose.yml` (serviço `minio`, `minio/minio` versão estável fixada por tag de release, portas `9000`/`9001` sobrescrevíveis por `MINIO_PORT`/`MINIO_CONSOLE_PORT`, volume, healthcheck; serviço one-shot `minio-init` com `minio/mc` criando o bucket `arenaz-photos` com leitura pública anônima), `.env.example`, `apps/api/src/config/env.ts` (+ testes de env), `apps/api/vitest.config.ts` (globalSetup do MinIO), `apps/api/src/venues/venues.service.ts` (`photos` no `Venue`, `coverUrl` no resumo, `DELETE` apaga objetos), `README.md` (MinIO e portas)

**Interfaces:**
- Env novo (validado em `loadEnv`): `S3_ENDPOINT` (url), `S3_REGION` (default `us-east-1`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` (url base pública dos objetos, ex. `http://localhost:9000/arenaz-photos`), `S3_FORCE_PATH_STYLE` (boolean, default `true`). `.env.example` com os valores do MinIO local (`minioadmin`).
- `StoragePort` (token `STORAGE`): `createUploadPost(key, contentType, maxBytes): Promise<{ url; fields; expiresAt }>` (presigned POST, expira em 10 min, condições `content-length-range` 1..maxBytes e `Content-Type` exato), `head(key): Promise<{ size: number; contentType: string } | null>`, `delete(keys: string[]): Promise<void>`, `publicUrl(key): string`.
- Rotas (`AuthGuard`, dono via `findOwnedVenue`):
  - `POST /owner/venues/:id/photos/upload-url` (`photoUploadRequestSchema`) → `PhotoUploadResponse`; chave `venues/{venueId}/{uuid}.{jpg|png|webp}`; já com `PHOTO_MAX_PER_VENUE` fotos → 422 `detail: "Limite de 20 fotos por espaço"`.
  - `POST /owner/venues/:id/photos` (`photoConfirmSchema`) → 201 `Photo` na última posição. 422 `detail: "Arquivo de foto inválido"` quando: chave fora de `venues/{venueId}/`, objeto inexistente, `contentType` fora de `PHOTO_CONTENT_TYPES` ou `size > PHOTO_MAX_BYTES`; chave já registrada → 409.
  - `PUT /owner/venues/:id/photos/order` (`photoOrderSchema`, precisa conter exatamente os ids do venue) → `Photo[]`.
  - `DELETE /owner/venues/:id/photos/:photoId` → 204 (apaga objeto e reordena posições).
- Testes: `minio-setup.ts` é um globalSetup Vitest que sobe `GenericContainer("minio/minio:<tag>")` com `server /data`, cria o bucket via `@aws-sdk/client-s3` e provê `S3_*` por `provide`/`process.env`.

- [ ] **Step 1: Testes que falham**

```ts
it("upload direto + confirmação cria a foto", async () => {
  const { url, fields, key } = (await post(`/api/owner/venues/${id}/photos/upload-url`, { contentType: "image/png", size: png.length })).json();
  const form = new FormData(); Object.entries(fields).forEach(([k, v]) => form.append(k, v)); form.append("file", new Blob([png], { type: "image/png" }));
  expect((await fetch(url, { method: "POST", body: form })).ok).toBe(true);
  const res = await post(`/api/owner/venues/${id}/photos`, { key });
  expect(res.statusCode).toBe(201);
  expect(res.json().url).toBe(`${S3_PUBLIC_URL}/${key}`);
});
it("storage recusa arquivo maior que o declarado/limite", async () => { /* POST ao storage com size acima → 4xx do storage */ });
it.each([["fora do prefixo", "venues/outro-id/x.png"], ["inexistente", `venues/${id}/nao-existe.png`]])(
  "confirmação %s → 422 e nenhuma foto criada", async (_n, key) => { /* … GET venue → photos [] */ });
it("tipo não permitido no pedido de URL → 422", async () => { /* contentType image/gif */ });
it("outro dono → 404 em upload-url, confirmação, ordem e delete", async () => { /* … */ });
it("espaço completo publica", async () => { /* horário + quadra ativa + foto → publish 200 status published */ });
it("apagar espaço apaga objetos do storage", async () => { /* DELETE venue → head(key) null */ });
```

- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm --filter @arenaz/api test`), e `pnpm db:up` sobe o MinIO local com bucket criado (`curl -I $S3_PUBLIC_URL/` responde).
- [ ] **Step 5: Commit** — `feat(api): photo uploads via presigned post to object storage`.

---

### Task 6: Consulta de CEP com localização

**Files:**
- Create: `apps/api/src/geo/{geo.port,http.geo,fake.geo,geo.controller,geo.module}.ts`, `apps/api/test/geo.test.ts`
- Modify: `apps/api/src/config/env.ts` (`GEO_PROVIDER: "http" | "fake"`, default `"http"`; `"fake"` proibido com `NODE_ENV=production`), `.env.example`

**Interfaces:**
- `GeoPort` (token `GEO`): `lookupCep(cep: string): Promise<CepLookupResponse | null>`.
- `HttpGeo`: ViaCEP (`https://viacep.com.br/ws/{cep}/json/`; `{erro:true}` → `null`) e depois Nominatim (`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=1&street=…&city=…&state=…&postalcode=…`, header `User-Agent: ArenaZ/0.1 (contato via repositório)`); falha/timeout do Nominatim → `location: null` (não é erro). Timeout 3 s por chamada (`AbortSignal.timeout`). Cache em memória: LRU 1000 entradas, TTL 24 h. No máximo 1 requisição/s ao Nominatim (fila simples).
- `FakeGeo`: tabela fixa; `"01310100"` → Av. Paulista, Bela Vista, São Paulo, SP, `{ lat: -23.5614, lng: -46.6559 }`; `"05435000"` → Rua Harmonia, Vila Madalena, São Paulo, SP, `{ lat: -23.5568, lng: -46.6916 }`; resto → `null`.
- `GET /api/geo/cep/:cep` (`AuthGuard`, rate limit de rota 30/min) → 200 `CepLookupResponse`; CEP inválido → 422; não encontrado → 404 `detail: "CEP não encontrado"`.

- [ ] **Step 1: Testes que falham** — `HttpGeo` com `fetch` injetado (função passada no construtor): ViaCEP ok + Nominatim ok → localização; ViaCEP `{erro:true}` → `null`; Nominatim timeout → `location: null`; segunda chamada usa cache (fetch chamado 2 vezes no total). Rota com `GEO_PROVIDER=fake`: 200, 404, 422, 401 sem login. `loadEnv` com `GEO_PROVIDER=fake` e `NODE_ENV=production` → erro citando `GEO_PROVIDER`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(api): cep lookup with geocoding behind a port`.

---

### Task 7: `packages/ui` — primitivas

**Files:**
- Create: `packages/ui/{package.json,tsconfig.json,eslint.config.js,vitest.config.ts}`, `packages/ui/src/{theme.css,button.tsx,field.tsx,input.tsx,textarea.tsx,select.tsx,checkbox.tsx,card.tsx,badge.tsx,alert.tsx,cn.ts,index.ts}`, testes `*.test.tsx`
- Modify: `apps/web/src/app/globals.css` (importa `@arenaz/ui/theme.css` no lugar do `@theme` local + `@source` para os componentes do pacote), `apps/web/src/components/auth/*` e `components/ui/*` (passam a usar `@arenaz/ui`; apagar `button-styles.ts` e `field.tsx`/`form-alert.tsx` locais se ficarem sem uso), `apps/web/package.json`

**Interfaces:**
- Pacote `@arenaz/ui` (React 19, sem build: `exports` aponta para `src/*.tsx` e `./theme.css`; o Next transpila via `transpilePackages: ["@arenaz/ui"]`). `typecheck`, `lint`, `test` como os outros pacotes.
- `theme.css`: o bloco `@theme` com **exatamente** os tokens de `docs/design/prototipo-v2.md` (move o que está em `apps/web/src/app/globals.css`), mais `--radius-photo: 20px`, `--radius-card: 24px`, `--radius-section: 32px`, `--radius-button: 14px`.
- Componentes (todos com `className` opcional e `ref` encaminhado onde for input):
  - `Button({ variant: "primary"|"secondary"|"ghost"|"danger" = "primary", size: "md"|"sm" = "md", loading?: boolean, ...button })` — `loading` desabilita e mostra "Aguarde…" para leitores de tela (`aria-busy`).
  - `Field({ label, hint?, error?, children })` — gera ids e injeta `id`, `aria-describedby`, `aria-invalid` no filho único (input/select/textarea); erro com `role` nenhum (o alerta do formulário é o `Alert`).
  - `Input`, `Textarea`, `Select({ options: {value,label}[], placeholder? })`, `Checkbox({ label })` — borda `--color-line-strong`, raio 14px, foco visível `outline-brand`.
  - `Card({ as?: "section"|"div", children })` — `--shadow-2`, raio 24px.
  - `Badge({ tone: "neutral"|"brand"|"free"|"warning" })`.
  - `Alert({ tone: "error"|"info"|"success", children })` — container sempre renderizado com `role="alert"` (`aria-live`), conteúdo vazio quando não há mensagem (corrige o minor do Plano 0).
  - `cn(...classes)` sem dependência externa.

- [ ] **Step 1: Testes que falham** — `Field` liga label ↔ input e `aria-describedby` aponta para hint e erro; `aria-invalid="true"` só com erro; `Button loading` fica `disabled` e `aria-busy`; `Alert` existe vazio com `role="alert"` e anuncia ao receber texto; `Select` renderiza placeholder desabilitado.
- [ ] **Step 2–4:** falhar → implementar → passar; `pnpm turbo run lint typecheck test build --filter @arenaz/web...` continua verde (testes de auth do Plano 0 passam sem mudar asserções).
- [ ] **Step 5: Commit** — `feat(ui): design system primitives and shared theme`.

---

### Task 8: Painel — espaços

**Files:**
- Create: `apps/web/src/app/painel/{layout,page}.tsx`, `apps/web/src/app/painel/espacos/novo/page.tsx`, `apps/web/src/app/painel/espacos/[id]/page.tsx`, `apps/web/src/components/owner/{venue-form,hours-editor,location-picker,owner-nav}.tsx` (+ testes), `apps/web/src/lib/{api,api-client}.ts` (+ testes)
- Modify: `apps/web/src/app/conta/page.tsx` (link "Painel do dono"), `apps/web/package.json` (`leaflet`, `react-leaflet`, `@types/leaflet`)

**Interfaces:**
- Consumes: rotas das Tasks 3 e 6; `@arenaz/ui`; schemas da Task 1; `getSession` e `safeNext` (Plano 0).
- Produces:
  - `lib/api.ts` (server-only): `apiGet<T>(path, schema): Promise<T>` encaminhando cookies (`cache: "no-store"`); 401 → `redirect("/entrar?next=<rota atual>")`; 404 → `notFound()`; outros → lança.
  - `lib/api-client.ts` (browser): `apiSend<T>(method, path, body, schema): Promise<{ ok: true; data: T } | { ok: false; status: number; fieldErrors: Record<string,string[]>; message: string }>` usando o mesmo mapeamento `Problem → campos` do `auth-client.ts` (extrair o helper comum `problemToFormError` para `lib/problem.ts` e usar nos dois).
  - `painel/layout.tsx`: server; sem sessão → `redirect("/entrar?next=/painel")`; cabeçalho com logo, nome do usuário e `OwnerNav` ("Meus espaços", "Conta").
  - `/painel`: lista `VenueSummary` (cards com capa, nome, cidade, `Badge` "Publicado"/"Rascunho", "N quadras") e botão "+ Novo espaço"; vazio → "Você ainda não cadastrou nenhum espaço."
  - `/painel/espacos/novo` e `/painel/espacos/[id]`: `VenueForm` (react-hook-form + `zodResolver(venueInputSchema)`), seções "Dados", "Endereço" (CEP com consulta no blur → preenche rua/bairro/cidade/UF e posiciona o pino; erro "CEP não encontrado" no campo), "Localização" (`LocationPicker`), "Comodidades" (checkboxes com `AMENITY_LABELS`), "Cancelamento" (radios com label + descrição). Após criar → `router.replace("/painel/espacos/{id}")`.
  - `LocationPicker({ value, onChange })`: Leaflet carregado só no cliente (`next/dynamic`, `ssr: false`), tiles OSM com atribuição, pino arrastável; alternativa acessível: campos numéricos "Latitude"/"Longitude" sempre presentes (o mapa é complemento, não único meio).
  - Página do espaço: `VenueForm` em modo edição, `HoursEditor` (7 linhas, checkbox "Aberto" + selects de 30 em 30 min, "Salvar horário" → `PUT hours`), lista de quadras com link "+ Nova quadra" (Task 9 cria as páginas), área de fotos (Task 9), e botão "Publicar"/"Despublicar" que mostra o `errors` do 422 como lista no `Alert`.

- [ ] **Step 1: Testes que falham** — `VenueForm`: CEP "01310-100" chama `apiSend("GET","/geo/cep/01310100")` mockado e preenche "Rua", "Bairro", "Cidade", "UF" e lat/lng; CEP não encontrado mostra erro no campo; submit inválido não chama a API. `HoursEditor`: desmarcar "Aberto" de domingo remove o dia do payload; fechamento antes da abertura mostra erro. Layout: sem sessão → `redirect("/entrar?next=/painel")`. `apiGet`: 401 → redirect, 404 → `notFound`.
- [ ] **Step 2–4:** falhar → implementar → passar; `pnpm --filter @arenaz/web build`.
- [ ] **Step 5: Commit** — `feat(web): owner panel venues with cep lookup, map pin and hours`.

---

### Task 9: Painel — quadras, preços, bloqueios e fotos

**Files:**
- Create: `apps/web/src/app/painel/espacos/[id]/quadras/novo/page.tsx`, `apps/web/src/app/painel/quadras/[fieldId]/page.tsx`, `apps/web/src/components/owner/{field-form,price-rules-editor,blocks-editor,photo-uploader,money-input}.tsx` (+ testes)
- Modify: `apps/web/src/app/painel/espacos/[id]/page.tsx` (lista de quadras e `PhotoUploader`)

**Interfaces:**
- Consumes: rotas das Tasks 4 e 5; `parseBrlToCents`, `formatCents`, catálogos (Task 1); `apiSend`/`apiGet` (Task 8).
- Produces:
  - `MoneyInput({ value: number|null /* centavos */, onChange })`: mostra `formatCents`, aceita digitação livre e converte com `parseBrlToCents` no blur; inválido → erro "Valor inválido" e `onChange(null)`.
  - `FieldForm`: nome, esportes (checkboxes `SPORT_LABELS`), piso (select), formato (select com "Sem formato"), medidas (opcionais, metros), duração mínima (30/60/90 min), preço base/hora (`MoneyInput`), "Quadra ativa".
  - `PriceRulesEditor`: linhas com dias (chips Dom–Sáb), início/fim (selects de 30 min), preço (`MoneyInput`), rótulo; "+ Faixa"; salvar → `PUT price-rules`; erro de sobreposição do servidor aparece na linha correspondente (`errors["1"]` → linha 2).
  - `BlocksEditor`: lista de bloqueios futuros ("Sáb, 31/10 das 18:00 às 22:00 — Manutenção", horários em `America/Sao_Paulo`), formulário data + início + fim + motivo (converte para ISO com offset `-03:00` via `Intl`/cálculo de fuso, não fixo), excluir com confirmação; 409 mostra o `detail`.
  - `PhotoUploader`: input de arquivo (múltiplos, `accept` com os 3 tipos), valida tipo/tamanho no cliente, para cada arquivo pede `upload-url`, faz POST multipart direto na `url` do storage com `fields` + `file`, confirma; mostra progresso e erro por arquivo; grade com capa (primeira), botões "Mover para a esquerda/direita" (acessíveis, sem depender de arrastar) → `PUT order`, "Remover".

- [ ] **Step 1: Testes que falham** — `MoneyInput`: digitar "R$ 1.234,50" + blur → `onChange(123450)` e mostra "R$ 1.234,50"; "abc" → erro e `onChange(null)`. `PriceRulesEditor`: 422 com `errors: {"1": ["Faixas de preço se sobrepõem"]}` mostra a mensagem na segunda linha. `PhotoUploader`: arquivo `image/gif` não chama a API e mostra "Use JPG, PNG ou WebP até 10 MB"; fluxo feliz chama upload-url → fetch do storage (mock) → confirmação, nessa ordem.
- [ ] **Step 2–4:** falhar → implementar → passar; `pnpm --filter @arenaz/web build`.
- [ ] **Step 5: Commit** — `feat(web): fields, price rules, blocks and photo uploads in the owner panel`.

---

### Task 10: E2E do dono e CI

**Files:**
- Create: `apps/web/e2e/owner.spec.ts`, `apps/web/e2e/fixtures/quadra.png` (PNG pequeno gerado, < 20 KB)
- Modify: `apps/web/e2e/playwright.config.ts` (env `GEO_PROVIDER=fake` e `S3_*` para a API), `.github/workflows/ci.yml` (serviço `minio` + criação do bucket antes do e2e; `push` também em `dev/redesign`; healthcheck do Postgres com `-h 127.0.0.1`), `turbo.json` (`passThroughEnv` do e2e com `S3_*`, `GEO_PROVIDER`)

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1: Teste e2e**

```ts
test("dono cadastra e publica um espaço", async ({ page }) => {
  // cadastro → /painel → "+ Novo espaço"
  // nome "Arena E2E <ts>", telefone, CEP "05435000" (fake) preenche endereço e posição; número "100"
  // comodidades "Vestiário", "Estacionamento"; cancelamento "Moderada" → Salvar → URL /painel/espacos/<id>
  // horário: seg–sex 08:00–23:00 → Salvar horário
  // "+ Nova quadra": "Society 1", Society, grama sintética, 7x7, 60 min, "R$ 180,00" → salvar
  // faixa: Sex/Sáb 18:00–23:00 "R$ 250,00" → Salvar faixas
  // fotos: setInputFiles(fixtures/quadra.png) → aparece 1 foto
  // "Publicar" → Badge "Publicado"
});
test("outro dono não abre o espaço", async ({ page, browser }) => {
  // dono A cria rascunho; contexto novo com dono B abre /painel/espacos/<id de A> → página 404 do Next
});
```

- [ ] **Step 2: Rodar** — `pnpm db:up && pnpm e2e` → 4 passed (2 do Plano 0 + 2 novos).
- [ ] **Step 3: CI** conforme *Files* — actions novas também fixadas por SHA; nenhuma secret; credenciais do MinIO são valores de teste no YAML.
- [ ] **Step 4: Verificar** — `pnpm turbo run lint typecheck test build` verde e `pnpm e2e` verde localmente.
- [ ] **Step 5: Commit** — `test(e2e): owner publishes a venue; ci runs minio`.

---

## Definição de pronto do Plano 1

- O dono, logado, cria espaço → horário → quadra com faixa → foto → publica, só pelo painel; outro dono recebe 404 em tudo isso.
- Os 5 itens do *Review Focus* têm teste passando.
- `pnpm turbo run lint typecheck test build` e `pnpm e2e` verdes; nenhum `any`/`@ts-ignore`/`eslint-disable` sem justificativa.
- `dev/redesign` atualizado no remoto.
- Próximo: Plano 2 (telas do jogador e do dono a partir do protótipo, sobre `packages/ui`).
