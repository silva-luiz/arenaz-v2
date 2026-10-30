# ArenaZ v2 — Cartões do hero com dados reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os dois cartões flutuantes do hero da home ("Reserva confirmada" e "Racha no Pix") mostram a próxima reserva confirmada e o racha reais do jogador logado, e voltam à ilustração (`HERO_SHOWCASE_MOCK`) para quem não está logado ou não tem reserva.

**Architecture:** Hoje os cartões leem um `HeroShowcase` (`apps/web/src/components/home/hero-showcase.ts`) vindo do mock. Uma rota nova da API (`GET /api/bookings/me/next`) devolve a próxima reserva confirmada do jogador já formatada para o cartão. Um hook do cliente busca essa rota depois da hidratação e troca o mock pelo dado real. Assim a home continua cacheável e nenhum dado de um jogador entra no HTML compartilhado. O cartão do racha depende do Plano 5 (divisão de pagamento) e fica no mock até lá; o contrato dele já está fixado aqui.

**Tech Stack:** NestJS/Fastify, Drizzle, zod (contracts), Next 16 App Router (client component), Vitest + Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-28-arenaz-v2-design.md` (§1 racha, §5 roadmap: Plano 5 "Mensalista + racha") + `docs/design/prototipo/Main.dc.html` (hero, cartões `.az-float`).

## Global Constraints

- Tudo dos planos anteriores vale: pt-BR, centavos inteiros, exibição no fuso **do espaço**, WCAG 2.2 AA, `prefers-reduced-motion`, versões estáveis fixadas.
- Dado de um jogador nunca vai para o HTML cacheado da home: a busca é no cliente, com o cookie de sessão, `cache: 'no-store'`.
- Sem sessão, sem reserva futura ou com erro na API: os cartões mostram `HERO_SHOWCASE_MOCK`, sem piscar nem deixar buraco (o mock é o estado inicial).
- O endereço exato e o telefone do espaço não aparecem no cartão (ele é decorativo, `aria-hidden`).
- O racha real só existe depois do Plano 5; até lá o cartão do racha é sempre o mock.

## Review Focus

- Reserva que começa perto da meia-noite ou em espaço fora de São Paulo: "Hoje"/"Amanhã"/dia da semana calculado no fuso do espaço.
- Reserva confirmada cancelada depois: some do cartão no próximo carregamento (a rota só devolve `confirmed` com início no futuro).
- Jogador com reserva `held` (não paga): não aparece como "Reserva confirmada".
- Sessão expirada (401) ou API fora: o cartão fica no mock e nada quebra na home.
- Nome de espaço longo (40+ caracteres): o cartão corta com reticências sem empurrar o código da reserva.

---

## Shared Interfaces

```ts
// packages/contracts/src/booking.ts
export const nextBookingSchema = z.object({
  bookingId: z.string().uuid(),
  venueName: z.string(),
  venueSlug: z.string(),
  coverUrl: z.string().nullable(),
  /** "Hoje · 20h às 22h · quadra 2", no fuso do espaço. */
  when: z.string(),
  /** "#AZ-" + 4 primeiros caracteres do id em maiúsculas, ex. "#AZ-4F21". */
  code: z.string(),
});
export const nextBookingResponseSchema = z.object({
  booking: nextBookingSchema.nullable(),
});

// Plano 5 (racha) — o cartão já lê este formato (HeroRachaShowcase):
// { perPersonCents: number; paid: number; total: number; payers: string[] /* iniciais */ }
```

---

### Task 1: API — próxima reserva confirmada do jogador

**Files:** Modify `packages/contracts/src/booking.ts` (+ teste), `apps/api/src/booking/bookings.controller.ts`, `apps/api/src/booking/bookings.service.ts` (+ teste de integração em `apps/api/test/`).

- [x] **Step 1: Write failing tests**: contrato aceita/recusa o formato acima; integração: jogador sem reservas → `{ booking: null }`; com uma `held` e uma `confirmed` futura → devolve só a `confirmed`; duas `confirmed` futuras → a que começa antes; `confirmed` já começada ou `cancelled` → ignoradas; reserva de outro jogador nunca aparece; `when` com "Hoje"/"Amanhã"/"Sáb, 31 out" e horas no fuso do espaço (caso de espaço em `America/Manaus`); sem sessão → 401.
- [x] **Step 2: Run** `pnpm --filter @arenaz/api test -- bookings` → FAIL.
- [x] **Step 3: Implement** `GET /api/bookings/me/next` (declarado antes de `GET /api/bookings/:id` para não colidir) com `AuthGuard`, uma consulta ordenada por início com `LIMIT 1`, relógio do banco (`dbNow`), `Cache-Control: no-store`. O texto de `when` usa os mesmos formatadores de data do web movidos para `packages/contracts` ou duplicados de forma mínima com teste — decida por mover se já houver helper em contracts.
- [x] **Step 4: Run** → PASS. **Step 5: Commit** `feat(api): próxima reserva confirmada do jogador`.

### Task 2: Web — cartão "Reserva confirmada" com dado real

**Files:** Create `apps/web/src/components/home/use-hero-showcase.ts` (+ teste). Modify `apps/web/src/components/home/home-hero.tsx`, `apps/web/src/components/home/hero-showcase.ts`.

**Interfaces:** Consumes Task 1. Produces `useHeroShowcase(): HeroShowcase` — começa com `HERO_SHOWCASE_MOCK`; depois da hidratação chama `apiSend('/api/bookings/me/next')`; se vier `booking`, troca só `showcase.booking` (`venueName`, `when`, `code`, `photoUrl = coverUrl ?? '/home/reserva-confirmada.jpg'`); 401, erro ou `null` mantêm o mock.

- [x] **Step 1: Write failing tests**: sem sessão (401) → mock; com reserva → o cartão mostra o nome, o `when` e o código reais; erro de rede → mock e nenhum erro na tela; a chamada usa `no-store` e acontece uma vez por montagem.
- [x] **Step 2–4:** FAIL → implementar → PASS (unit + `pnpm --filter @arenaz/web e2e` com um caso novo em `e2e/booking.spec.ts`: depois de pagar, a home mostra a reserva no cartão).
- [x] **Step 5: Commit** `feat(web): cartão do hero mostra a próxima reserva do jogador`.

### Task 3: Racha real no cartão (depende do Plano 5)

**Files:** Modify `use-hero-showcase.ts` e a rota da Task 1 (campo `racha` opcional).

- [ ] **Step 1:** Quando o Plano 5 existir, a rota da Task 1 devolve também `racha: { perPersonCents, paid, total, payers }` da reserva (iniciais dos primeiros a pagar). Teste: reserva com racha → cartão mostra "x de y pagaram" e a barra proporcional; sem racha → mock.
- [ ] **Step 2–5:** FAIL → implementar → PASS → commit `feat(web): cartão do racha com dados reais`.

### Task 4: Verificação

- [ ] `pnpm install --frozen-lockfile`; `pnpm turbo run lint typecheck test build --concurrency=2 --force`; e2e com `E2E_WEB_PORT=3102 E2E_API_PORT=4102`; screenshots do hero em 768, 914, 1024 e 1440 px logado (com e sem reserva) e deslogado.
