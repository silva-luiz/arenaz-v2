# ArenaZ v2 — Motor de reservas (Plano 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O jogador vê horários livres com preço real, segura o horário (hold de 10 min), paga (provedor falso até o Plano 4) e a reserva é confirmada; o dono vê a agenda, cria reserva manual e bloqueia horários — sem nunca existir duas reservas ativas sobrepostas na mesma quadra.

**Architecture:** Primeiro uma migration que fecha as decisões pendentes do Plano 1 (fuso do espaço, turnos múltiplos por dia, CHECKs, EXCLUDE). Tabela `booking` com `EXCLUDE USING gist (field_id WITH =, period WITH &&) WHERE (status IN ('held','confirmed'))`. O cálculo de disponibilidade e preço é um módulo **puro** (`packages/booking-core`) testado à exaustão, usado pela API. Pagamento atrás de `PaymentPort` (só `FakePayment` agora, proibido em produção). Holds expiram por um worker BullMQ (`apps/worker`) **e** de forma preguiçosa dentro da transação de reserva. Web: seletor de horário na página do espaço (ilha client), checkout com Pix simulado, "Minhas reservas" e agenda do dono.

**Tech Stack:** o dos Planos 0–2 + `@date-fns/tz` (fusos), BullMQ + Redis (worker), `@testcontainers/redis`.

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md` (§1 tabela "Onde ganhar…", §3 "Escalabilidade" itens 2 e 4, "Modelo de domínio": `booking`, §4). Visual: `docs/design/prototipo-v2.md` + `docs/design/prototipo/{Quadra,Checkout,Painel}.dc.html`. Decisões herdadas: ledgers dos Planos 1 e 2 (pasta de notas da sessão) — fuso, turnos, CHECKs, EXCLUDE, protocolo de lock, booking card como ilha client, endpoint de disponibilidade separado e `no-store`.

## Global Constraints

- Tudo dos Planos 0–2 vale (versões estáveis, `strict`, TS 6.x, pt-BR, `problem+json`, centavos inteiros, `timestamptz` UTC, exibição no fuso **do espaço**, 404 para recurso alheio, WCAG 2.2 AA, mobile-first, nada de dado inventado, dados privados nunca em rota pública).
- **Invariante:** nunca duas reservas `held`/`confirmed` sobrepostas na mesma quadra — garantido pelo EXCLUDE no banco; a aplicação só traduz o erro (`23P01`) em 409.
- Reserva vs. bloqueio (tabelas diferentes, sem EXCLUDE cruzado): **toda** escrita de reserva ou bloqueio trava a linha da quadra (`SELECT … FROM field WHERE id = $1 FOR UPDATE`) e checa a outra tabela na mesma transação. Ordem de locks: venue → field (nunca ao contrário).
- Granularidade de 30 min; reserva dura múltiplo de 30 e ≥ `min_slot_minutes`; começa e termina dentro de um intervalo de funcionamento (no fuso do espaço); não começa no passado; horizonte máximo de 60 dias.
- Preço = soma por segmento de 30 min: preço/hora da faixa que cobre o segmento (desempate: a faixa de menor `start_minute`, depois menor `id`) ou o preço base; cada segmento vale `round(preco_hora / 2)` centavos. Sempre calculado no servidor.
- Hold dura 10 min (`HOLD_MINUTES = 10`).
- `PAYMENT_PROVIDER=fake` é proibido com `NODE_ENV=production` (mesmo padrão do `GEO_PROVIDER`). O botão "Simular pagamento" só existe quando o provedor é `fake`.
- Endereço exato (rua, número, complemento, CEP) e telefone do espaço só aparecem para o dono da reserva **confirmada**.

## Review Focus

1. **Dois jogadores no mesmo horário ao mesmo tempo** → exatamente um hold é criado; o outro recebe 409 "Esse horário acabou de ser reservado". Teste concorrente na Task 5.
2. **Fuso e virada de dia** (espaço em `America/Manaus`, turno 18:00–24:00 + 00:00–02:00 do dia seguinte, reserva cruzando meia-noite) → horários e preço corretos no fuso do espaço. Testes na Task 3.
3. **Hold expirado** → libera o horário imediatamente para outro jogador (expiração preguiçosa) e o pagamento atrasado não confirma ("O prazo para pagamento acabou"). Testes nas Tasks 5 e 6.
4. **Dono apaga/desativa quadra, despublica ou apaga espaço com reservas futuras** → 409 com mensagem pt-BR, nada muda; bloqueio sobre reserva confirmada → 409. Testes na Task 7.
5. **Entrada hostil na reserva** (início no passado, não múltiplo de 30, abaixo do mínimo, fora do horário, além de 60 dias, quadra inativa, espaço despublicado, preço enviado pelo cliente) → 422/409 claro; o preço do cliente é ignorado. Testes na Task 5.

---

## Mapa de arquivos

```
packages/db/migrations/   0006_booking_foundations.sql (timezone, venue_hours com id, CHECKs, EXCLUDE de bloqueio),
                          0007_booking.sql (tabela booking + EXCLUDE + índices)
packages/db/src/schema/   venue.ts, field.ts, booking.ts
packages/contracts/src/   timezone.ts, venue.ts (hours v2), booking.ts, availability.ts, payment.ts (+ testes)
packages/booking-core/    package.json, src/{time,availability,pricing,index}.ts (+ testes)
apps/api/src/booking/     bookings.controller.ts, bookings.service.ts, bookings.module.ts, booking-errors.ts
apps/api/src/availability/ availability.controller.ts, availability.service.ts
apps/api/src/payments/    payment.port.ts, fake.payment.ts, payments.controller.ts, payments.module.ts
apps/api/src/owner-agenda/ agenda.controller.ts, agenda.service.ts
apps/worker/              package.json, src/{main,expire-holds}.ts (+ testes)
apps/web/src/components/booking/  slot-picker.tsx, booking-summary.tsx, pix-payment.tsx, countdown.tsx (+ testes)
apps/web/src/app/(public)/espacos/[slug]/ (usa o SlotPicker), (account)/reservas/{page,[id]/page}.tsx
apps/web/src/app/painel/espacos/[id]/agenda/page.tsx, components/owner/{agenda-grid,manual-booking-form,block-form}.tsx
apps/web/e2e/booking.spec.ts
```

---

### Task 1: Fundações — fuso, turnos, CHECKs e EXCLUDE de bloqueio

**Files:**
- Create: `packages/db/migrations/0006_booking_foundations.sql` (gerada + ajustes manuais registrados), `packages/contracts/src/timezone.ts` (+ test)
- Modify: `packages/db/src/schema/{venue,field}.ts`, `packages/contracts/src/{venue,public-venue}.ts` (+ tests), `apps/api/src/venues/*`, `apps/api/src/public/*`, `apps/web/src/components/owner/{venue-form,hours-editor}.tsx`, `apps/web/src/components/public/venue-details.tsx`, `apps/web/src/lib/price-rule-summary.ts`

**Interfaces:**
- `BRAZIL_TIMEZONES` (lista IANA brasileira: `America/Sao_Paulo`, `America/Bahia`, `America/Fortaleza`, `America/Recife`, `America/Maceio`, `America/Belem`, `America/Araguaina`, `America/Manaus`, `America/Boa_Vista`, `America/Porto_Velho`, `America/Cuiaba`, `America/Campo_Grande`, `America/Rio_Branco`, `America/Noronha`, `America/Santarem`, `America/Eirunepe`) com rótulos pt-BR ("Horário de Brasília", "Amazonas (UTC−4)"…); `defaultTimezoneForUf(uf): string` (AC→Rio_Branco, AM→Manaus, RR→Boa_Vista, RO→Porto_Velho, MT→Cuiaba, MS→Campo_Grande, PA/AP→Belem, TO→Araguaina, MA/PI/CE/RN/PB→Fortaleza, PE→Recife, AL/SE→Maceio, BA→Bahia, demais→Sao_Paulo); `timezoneSchema` (enum dessa lista).
- `venue.timezone text not null` (backfill pela UF, CHECK na lista); `venueInputSchema.timezone` opcional (default pela UF no serviço); `venueSchema.timezone`; `publicVenueSchema.timezone`.
- **Horário v2:** `venue_hours` ganha `id uuid pk`, perde a PK (`venue_id`,`weekday`); vários intervalos por dia; CHECK `0 ≤ open < close ≤ 1440`, múltiplos de 30. `venueHoursSchema` = array (≤ 21) de `{ weekday, openMinute, closeMinute }` sem sobreposição no mesmo dia (mensagem "Horários se sobrepõem"). Turno que vira a noite = dois intervalos (o editor oferece "Vira a madrugada até" que gera o segundo intervalo no dia seguinte).
- `price_rule` CHECKs: minutos 0–1440 múltiplos de 30, `weekdays` não vazio e ⊂ 0–6, `price_cents_per_hour` ≤ 1_000_000.
- `availability_block` CHECK `lower_inc(period) AND NOT upper_inc(period) AND NOT lower_inf(period) AND NOT upper_inf(period)` + `EXCLUDE USING gist (field_id WITH =, period WITH &&)` (btree_gist já instalado). O 409 de bloqueio passa a vir também do `23P01`.
- Web: `HoursEditor` com vários intervalos por dia (+/− intervalo) e o atalho de madrugada; `VenueForm` com select de fuso (default pela UF ao trocar a UF); `OpeningHours` público lista vários intervalos ("08:00–12:00, 17:00–24:00").

- [ ] **Step 1: Testes que falham** — db: CHECKs rejeitam (`price_rule` minuto 45, weekdays `{}`/`{9}`, preço 1_000_001; bloqueio `(]` e infinito; dois bloqueios sobrepostos → `23P01`); contracts: dois intervalos que se cruzam → erro, encostados → ok, `defaultTimezoneForUf('AM') === 'America/Manaus'`; API: criar espaço sem fuso em AM → `America/Manaus`; PUT hours com 2 intervalos na sexta; web: editor gera os dois intervalos do atalho de madrugada.
- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm turbo run lint typecheck test build`).
- [ ] **Step 5: Commit** — `feat: venue timezone, split shifts, stricter checks and block exclusion`.

---

### Task 2: Tabela `booking`

**Files:**
- Create: `packages/db/src/schema/booking.ts`, `packages/db/migrations/0007_booking.sql`, `packages/contracts/src/booking.ts` (+ test), `packages/db/test/booking.test.ts`

**Interfaces:**
- `booking`: `id uuid`, `field_id uuid fk field ON DELETE RESTRICT`, `venue_id uuid fk venue ON DELETE RESTRICT` (desnormalizado p/ agenda), `user_id text null fk user ON DELETE SET NULL` (null = reserva manual), `origin text check in ('app','manual')`, `status text check in ('held','confirmed','cancelled','expired')`, `period tstzrange not null` (mesmos CHECKs de bounds do bloqueio), `total_cents integer check > 0`, `price_breakdown jsonb not null` (`[{startsAt, endsAt, priceCents}]`), `hold_expires_at timestamptz null` (obrigatório quando `held`), `customer_name text null`, `customer_phone text null` (manual), `created_at`, `confirmed_at`, `cancelled_at`, `cancelled_by text null check in ('player','owner','system')`. `EXCLUDE USING gist (field_id WITH =, period WITH &&) WHERE (status IN ('held','confirmed'))`. Índices: `(venue_id, lower(period))`, `(user_id, created_at desc)`, parcial `(hold_expires_at) WHERE status = 'held'`.
- Contratos: `BOOKING_STATUSES`, `BOOKING_STATUS_LABELS` ("Aguardando pagamento", "Confirmada", "Cancelada", "Expirada"), `bookingSchema` (resposta do jogador: `id, status, startsAt, endsAt, totalCents, holdExpiresAt|null, venue {slug,name,neighborhood,city,timezone}, field {id,name}, address|null` — address só quando confirmada), `createBookingInputSchema = { fieldId: uuid, startsAt: ISO com offset, durationMinutes: int múltiplo de 30, 30..360 }` (nada de preço).

- [ ] **Step 1: Testes que falham** — db: dois `held` sobrepostos → `23P01`; `cancelled` + `held` no mesmo período → ok; encostados → ok; apagar quadra com reserva → `23503`; `held` sem `hold_expires_at` → `23514`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(db): bookings with overlap exclusion`.

---

### Task 3: `packages/booking-core` — disponibilidade e preço (puro)

**Files:**
- Create: `packages/booking-core/{package.json,tsconfig*.json,eslint.config.js,vitest.config.ts}`, `src/{time,availability,pricing,index}.ts` (+ testes)

**Interfaces (sem I/O, sem relógio global — `now` é parâmetro):**
- `localDayRange(date: 'YYYY-MM-DD', tz): { start: Date; end: Date }`; `toInstant(date, minuteOfDay, tz): Date` (1440 → 00:00 do dia seguinte); `localDateOf(instant, tz)`; via `@date-fns/tz`.
- `openWindows(date, tz, hours: {weekday,openMinute,closeMinute}[]): Interval[]` — intervalos do dia local (une intervalos encostados, inclusive o 00:00 do dia seguinte que continua um 24:00, para permitir reserva atravessando meia-noite).
- `priceSegments(start, end, tz, basePriceCentsPerHour, rules): { startsAt; endsAt; priceCents }[]` — segmentos de 30 min com a regra de preço das Global Constraints (dia da semana e minuto avaliados no fuso do espaço, por segmento).
- `daySlots({ date, tz, now, hours, field: {minSlotMinutes, basePriceCentsPerHour}, rules, busy: Interval[] /* bloqueios + reservas ativas */, horizonDays = 60 }): { startsAt; endsAt; available: boolean; priceCents }[]` — um item por início de 30 min dentro do funcionamento; `available` = o bloco de `minSlotMinutes` a partir dali cabe no funcionamento, não cruza `busy` e não começa antes de `now`; `priceCents` = preço daquele bloco mínimo.
- `validateBooking({ start, durationMinutes, tz, now, hours, field, rules, busy, horizonDays }): { ok: true; segments; totalCents } | { ok: false; code: 'past'|'misaligned'|'too_short'|'closed'|'too_far'|'busy' }`.

- [ ] **Step 1: Testes que falham** (tabelados, sem banco):

```ts
it("preço por segmento com faixa parcial", () => {
  // base 18000/h; faixa Sex 19:00–23:00 25000/h; reserva Sex 18:00–20:00 SP → 9000+9000+12500+12500 = 43000
});
it("Manaus: 18h local = 22:00Z", () => { /* toInstant('2026-11-06', 1080, 'America/Manaus') */ });
it("turno 18–24 + 00–02 permite reserva 23:00–01:00 e cobra pelo dia de cada segmento", () => { /* … */ });
it("slot indisponível quando o bloco mínimo cruza bloqueio, reserva ou fechamento", () => { /* … */ });
it.each(["past","misaligned","too_short","closed","too_far","busy"])("validateBooking → %s", (code) => { /* … */ });
it("desempate de faixas sobrepostas legadas: menor start, depois menor id", () => { /* … */ });
```

- [ ] **Step 2–4:** falhar → implementar → passar (`pnpm --filter @arenaz/booking-core test`); cobertura ≥ 95% de linhas no pacote.
- [ ] **Step 5: Commit** — `feat(booking-core): availability and pricing engine`.

---

### Task 4: Disponibilidade pública

**Files:**
- Create: `apps/api/src/availability/{availability.controller,availability.service,availability.module}.ts`, `packages/contracts/src/availability.ts` (+ test), `apps/api/test/availability.e2e.test.ts`

**Interfaces:**
- `GET /api/venues/:slug/availability?date=YYYY-MM-DD` (sem login, rate limit 60/min, `Cache-Control: no-store`): só espaço publicado e quadras ativas; `date` entre hoje e hoje+60 no fuso do espaço (fora → 422); resposta `{ date, timezone, fields: [{ id, name, minSlotMinutes, slots: [{ startsAt, endsAt, available, priceCents }] }] }` — sem ids de reserva, nomes, status ou motivo de bloqueio. Uma consulta para bloqueios + reservas ativas (`held` não expirado ou `confirmed`) do dia de todas as quadras.

- [ ] **Step 1: Testes que falham** — slots corretos para um dia com faixa e bloqueio; reserva `held` expirada não ocupa; rascunho → 404; `date` passada/além de 60 dias/inválida → 422; resposta não contém `bookingId`, `userId`, `reason`.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(api): public availability by day`.

---

### Task 5: Hold, pagamento simulado e confirmação

**Files:**
- Create: `apps/api/src/booking/{bookings.controller,bookings.service,bookings.module,booking-errors}.ts`, `apps/api/src/payments/{payment.port,fake.payment,payments.controller,payments.module}.ts`, `packages/contracts/src/payment.ts`, `apps/api/test/{bookings.e2e,payments.e2e}.test.ts`
- Modify: `apps/api/src/config/env.ts` (`PAYMENT_PROVIDER: 'fake'`, obrigatório; proibido em produção até o Plano 4 — mensagem citando a variável)

**Interfaces (todas com `AuthGuard` exceto o webhook falso):**
- `POST /api/bookings` (`createBookingInputSchema`): transação — trava a quadra (`FOR UPDATE`), expira holds vencidos daquela quadra (`UPDATE … SET status='expired' WHERE status='held' AND hold_expires_at < now()`), carrega espaço (publicado), quadra (ativa), horários, faixas, bloqueios e reservas ativas do intervalo, roda `validateBooking`, insere `held` com `hold_expires_at = now() + 10 min`, `total_cents` e `price_breakdown` do servidor. Erros: `past/misaligned/too_short/closed/too_far` → 422 com mensagens pt-BR; `busy` ou `23P01` → 409 "Esse horário acabou de ser reservado"; quadra/espaço indisponível → 404. Um jogador pode ter no máximo 3 holds ativos (422 "Você já tem reservas aguardando pagamento").
- `GET /api/bookings/me` → lista (próximas primeiro, depois passadas); `GET /api/bookings/:id` → `Booking` (só do próprio jogador, senão 404; `address` só se `confirmed`).
- `POST /api/bookings/:id/payment` → `PaymentPort.createCharge({ bookingId, amountCents, expiresAt })` → `{ chargeId, method: 'pix', qrCodeSvg, copyPaste, expiresAt, simulatable: boolean }` (fake: QR SVG gerado a partir de um texto fictício "ARENAZ-FAKE-…", sem dado real).
- `POST /api/payments/fake/:chargeId/pay` (só registrado quando `PAYMENT_PROVIDER=fake`): confirma se a reserva está `held` e `hold_expires_at > now()` (na mesma transação com lock da quadra); expirada → 409 "O prazo para pagamento acabou"; idempotente para já confirmada.
- `POST /api/bookings/:id/cancel` (jogador): `held` → `cancelled` (by player); `confirmed` → `cancelled` só se faltarem ≥ 24h (reembolso fica para o Plano 4 — resposta diz "Cancelada. O reembolso será tratado pelo suporte."); senão 409.

- [ ] **Step 1: Testes que falham** — feliz (hold → payment → pay → confirmed, `address` aparece); 10 requisições simultâneas no mesmo slot → 1×201 + 9×409; hold vencido (relógio do banco: atualizar `hold_expires_at` para o passado no teste) libera o slot e o pay → 409; cada código de validação; preço enviado no corpo é ignorado (campo extra rejeitado ou descartado); outro jogador → 404 em get/payment/cancel; limite de 3 holds; `PAYMENT_PROVIDER=fake` + produção → `loadEnv` falha.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(api): booking holds, simulated pix and confirmation`.

---

### Task 6: Worker de expiração

**Files:**
- Create: `apps/worker/{package.json,tsconfig*.json,eslint.config.js,vitest.config.ts}`, `apps/worker/src/{main,expire-holds,env}.ts` (+ testes)
- Modify: `turbo.json` (dev/build/test do worker), `README.md`, `.env.example`, `.github/workflows/ci.yml` (sem mudança de serviço: testes usam Testcontainers)

**Interfaces:**
- `expireHolds(db, now?): Promise<number>` — `UPDATE booking SET status='expired', cancelled_by='system' WHERE status='held' AND hold_expires_at < now() RETURNING id` em lotes de 500.
- `main.ts`: BullMQ `Queue('maintenance')` + job repetível `expire-holds` a cada 30 s (`repeat: { every: 30000 }`, `jobId` fixo para não duplicar), `Worker` com concorrência 1; env validado (`DATABASE_URL`, `REDIS_URL`); encerramento limpo em SIGTERM/SIGINT; logs pino.
- Scripts: `dev` (como a API, sem shell), `start`, `build`, `test`.

- [ ] **Step 1: Testes que falham** — `expireHolds` expira só os vencidos e não toca `confirmed`; integração com Redis (Testcontainers) processa o job repetível uma vez e não duplica o agendamento ao reiniciar.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(worker): expire stale booking holds`.

---

### Task 7: Lado do dono — agenda, reserva manual e regras com reservas futuras

**Files:**
- Create: `apps/api/src/owner-agenda/{agenda.controller,agenda.service,agenda.module}.ts`, `apps/api/test/owner-agenda.e2e.test.ts`
- Modify: `apps/api/src/fields/fields.service.ts`, `apps/api/src/venues/venues.service.ts`, `apps/api/src/venues/publishing.ts` (se preciso)

**Interfaces (AuthGuard, dono via `findOwnedVenue`/`findOwnedField`):**
- `GET /api/owner/venues/:id/agenda?date=` → `{ date, timezone, fields: [{ id, name, items: [{ kind: 'booking', id, startsAt, endsAt, status, origin, customerName, totalCents } | { kind: 'block', id, startsAt, endsAt, reason }] }] }` — `customerName` = nome do jogador (só primeiro nome + inicial do sobrenome) ou o nome digitado na manual.
- `POST /api/owner/fields/:id/bookings` (`{ startsAt, durationMinutes, customerName (2–80), customerPhone? }`) → reserva `confirmed`, `origin='manual'`, mesmas validações de `validateBooking` (só horários futuros); conflito → 409.
- `POST /api/owner/bookings/:id/cancel` → `cancelled` (by owner) para `held`/`confirmed` futuras.
- Regras novas (409 pt-BR, nada muda): apagar ou desativar quadra com reserva futura ativa ("Esta quadra tem reservas futuras"); apagar ou despublicar espaço com reserva futura ativa ("Este espaço tem reservas futuras"); criar bloqueio sobre reserva ativa ("Já existe uma reserva nesse período"). Todas sob o protocolo de lock venue → field.

- [ ] **Step 1: Testes que falham** — agenda mostra reserva do app e manual e bloqueio; manual em conflito → 409; outro dono → 404 em tudo; cada regra de reserva futura → 409 e estado intacto; reserva passada não impede apagar.
- [ ] **Step 2–4:** falhar → implementar → passar.
- [ ] **Step 5: Commit** — `feat(api): owner agenda, manual bookings and future-booking guards`.

---

### Task 8: Seletor de horário na página do espaço

**Files:**
- Create: `apps/web/src/components/booking/{slot-picker,booking-summary}.tsx` (+ testes), `apps/web/src/lib/booking-client.ts`
- Modify: `apps/web/src/components/public/booking-card.tsx` (vira ilha client), `apps/web/src/app/(public)/espacos/[slug]/page.tsx`

**Interfaces:**
- `BookingCard({ slug, timezone, fields: { id, name, minSlotMinutes }[], minPriceCentsPerHour, signedIn: boolean })` — mantém `<aside data-booking-bar>` e `--booking-bar-h`. Desktop: o seletor fica no card. Mobile: a barra mostra preço + "Escolher horário" que abre um `<dialog>` (sheet) com o seletor (foco preso, Esc fecha, foco volta).
- `SlotPicker`: chips de data (hoje + 13 dias, rótulo "Hoje", "Amanhã", "Sex 6"), select de quadra, grade de horários (Geist Mono) vinda de `GET /api/venues/:slug/availability?date=` (browser, `cache: 'no-store'`); "Toque em horários seguidos para jogar mais tempo." — seleção contígua a partir do bloco mínimo, estendendo de 30 em 30 enquanto disponível; resumo com início–fim e total (soma dos `priceCents` dos segmentos). Botão "Reservar": sem login → `/entrar?next=/espacos/<slug>`; com login → `POST /api/bookings` → `/reservas/<id>`; 409 → mensagem e recarrega a grade.
- Fuso: todos os horários exibidos no `timezone` do espaço com o texto "Horários de {rótulo do fuso}" quando diferente de Brasília.

- [ ] **Step 1: Testes que falham** — chips e grade com disponibilidade mockada; seleção contígua e bloqueio de seleção através de horário ocupado; total; anônimo → redirect com `next`; 409 mostra mensagem e recarrega; mobile abre/fecha o dialog e devolve o foco.
- [ ] **Step 2–4:** falhar → implementar → passar; capturas 1280/375 no navegador.
- [ ] **Step 5: Commit** — `feat(web): slot picker on the venue page`.

---

### Task 9: Checkout com Pix simulado e "Minhas reservas"

**Files:**
- Create: `apps/web/src/app/(account)/reservas/{page,[id]/page}.tsx`, `apps/web/src/components/booking/{pix-payment,countdown,booking-status}.tsx` (+ testes)
- Modify: `@arenaz/ui` `TabBar` (item "Reservas" entre "Buscar" e "Conta"), `SiteHeader` (link "Minhas reservas" quando logado)

**Interfaces:**
- `/reservas/[id]` (server, login obrigatório; 404 alheio): por status — `held`: revisão (espaço, quadra, data/hora no fuso, total, política de cancelamento) + `PixPayment` (QR, "Copiar código", `Countdown` até `holdExpiresAt` com `aria-live` só a cada minuto e no fim; "Simular pagamento" só se `simulatable`) → ao confirmar, recarrega; `confirmed`: "Quadra garantida" + endereço completo + telefone do espaço + "Cancelar reserva" (regra das 24h); `expired`/`cancelled`: estado e link "Escolher outro horário".
- `/reservas`: listas "Próximas" e "Anteriores" com `Badge` de status.

- [ ] **Step 1: Testes que falham** — countdown chega a zero e mostra "O prazo para pagamento acabou"; "Copiar código" usa clipboard e anuncia; "Simular pagamento" ausente quando `simulatable=false`; confirmada mostra endereço; cancelamento < 24h mostra o 409.
- [ ] **Step 2–4:** falhar → implementar → passar; capturas 375 do fluxo.
- [ ] **Step 5: Commit** — `feat(web): checkout with simulated pix and my bookings`.

---

### Task 10: Agenda do dono no painel

**Files:**
- Create: `apps/web/src/app/painel/espacos/[id]/agenda/page.tsx`, `apps/web/src/components/owner/{agenda-grid,manual-booking-form,agenda-block-form,booking-detail}.tsx` (+ testes)
- Modify: `apps/web/src/app/painel/espacos/[id]/page.tsx` (link "Agenda")

**Interfaces:**
- Página: abas de dia (hoje + 6), grade quadra × hora (colunas = quadras, linhas = 30 min no funcionamento) com itens coloridos por origem (cores do protótipo: app `#DDF0E5/#8CC9A6/#0B4A2E`, manual `#F2F2F2/#C4C4C4/#333`) e bloqueios hachurados; legenda; cada item é um botão que abre `BookingDetail` (cliente, horário, total, origem, "Cancelar reserva" com confirmação). Mobile: lista por quadra em vez de grade. Botões "+ Reserva manual" e "Bloquear horário" abrem formulários (dialog) que usam os endpoints das Tasks 7 e 1/Plano 1.
- Acessibilidade: a grade é uma `table` com cabeçalhos de quadra e hora; itens anunciam "Reserva de {cliente}, 18:00–20:00, confirmada".

- [ ] **Step 1: Testes que falham** — renderiza itens nas células certas no fuso; detalhe e cancelamento; manual em conflito mostra 409; mobile em lista.
- [ ] **Step 2–4:** falhar → implementar → passar; capturas.
- [ ] **Step 5: Commit** — `feat(web): owner agenda with manual bookings and blocks`.

---

### Task 11: E2E da reserva e CI

**Files:**
- Create: `apps/web/e2e/booking.spec.ts`
- Modify: `apps/web/e2e/playwright.config.ts` (`PAYMENT_PROVIDER=fake`), `.github/workflows/ci.yml` (env), `turbo.json` (`passThroughEnv`)

- [ ] **Step 1: Testes e2e** — (1) jogador anônimo abre o espaço semeado → escolhe amanhã, 2 horários seguidos → "Reservar" → login → volta → reserva → checkout → "Simular pagamento" → "Quadra garantida" com endereço; dono vê a reserva na agenda; (2) dois contextos tentam o mesmo horário quase juntos → um vê "Esse horário acabou de ser reservado"; (3) axe sem violações sérias no seletor (desktop e 375 com o dialog aberto), no checkout e na agenda.
- [ ] **Step 2: Rodar** — `pnpm e2e` → todos passam (8 anteriores + 3).
- [ ] **Step 3: Verificar** — `pnpm turbo run lint typecheck test build` verde.
- [ ] **Step 4: Commit** — `test(e2e): book, pay and see it in the owner agenda`.

---

## Definição de pronto do Plano 3

- Jogador reserva e "paga" (simulado) só pela web; dono vê na agenda, cria manual e bloqueia; nenhuma sobreposição possível (EXCLUDE + teste concorrente).
- Os 5 itens do *Review Focus* têm teste passando; `axe` sem violações sérias nas telas novas.
- `pnpm turbo run lint typecheck test build` e `pnpm e2e` verdes; `dev/redesign` atualizado no remoto.
- Próximo: Plano 4 (PSP real com split, reembolso pela política) troca o `FakePayment` mantendo o `PaymentPort`.
