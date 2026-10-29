import {
  bookingSchema,
  cancelBookingResponseSchema,
  type Problem,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import {
  at,
  expireHold,
  insertBooking,
  seedVenue,
  spDate,
  type SeededVenue,
} from './booking-seed.js';
import { asUser, buildTestApp, signUpAs, type AsUser } from './helpers.js';

const { booking, availabilityBlock } = schema;

let app: NestFastifyApplication;
let handle: DbHandle;
let ownerId: string;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
  ({ userId: ownerId } = await signUpAs(app, 'Maria Dona Arena'));
});

afterAll(async () => {
  await app.close();
});

interface Player {
  userId: string;
  api: AsUser;
}

async function newPlayer(): Promise<Player> {
  const { cookie, userId } = await signUpAs(app, 'Joana Jogadora');
  return { userId, api: asUser(app, cookie) };
}

const problem = (res: LightMyRequestResponse): Problem => res.json<Problem>();

/** POST /api/bookings for a window of one day (`from`-`to`, SP wall clock). */
function request(
  s: SeededVenue,
  date: string,
  from: string,
  minutes: number,
  extra: object = {},
) {
  return {
    fieldId: s.fieldId,
    startsAt: at(date, from).toISOString(),
    durationMinutes: minutes,
    ...extra,
  };
}

const MIN = 60_000;

describe('POST /api/bookings', () => {
  it('exige login', async () => {
    const s = await seedVenue(handle, ownerId);
    const res = await app.inject({
      method: 'POST',
      url: '/api/bookings',
      payload: request(s, spDate(3), '09:00', 120),
    });
    expect(res.statusCode).toBe(401);
    const list = await app.inject({ method: 'GET', url: '/api/bookings/me' });
    expect(list.statusCode).toBe(401);
  });

  it('segura o horário por 10 minutos com preço do servidor, sem endereço', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const date = spDate(3);
    const before = Date.now();
    const res = await p.api.post(
      '/api/bookings',
      request(s, date, '09:00', 120),
    );
    expect(res.statusCode).toBe(201);
    const body = bookingSchema.parse(res.json());
    expect(body.status).toBe('held');
    expect(body.totalCents).toBe(20000);
    expect(body.startsAt).toBe(at(date, '09:00').toISOString());
    expect(body.endsAt).toBe(at(date, '11:00').toISOString());
    expect(body.address).toBeNull();
    expect(body.venue).toMatchObject({
      slug: s.slug,
      city: 'Cidade Teste',
      timezone: 'America/Sao_Paulo',
    });
    expect(body.field).toEqual({ id: s.fieldId, name: 'Quadra A' });
    const hold = new Date(body.holdExpiresAt ?? '').getTime();
    expect(hold).toBeGreaterThanOrEqual(before + 10 * MIN - 1000);
    expect(hold).toBeLessThanOrEqual(Date.now() + 10 * MIN + 1000);
    // The exact address never shows before payment.
    expect(res.body).not.toContain('Rua Sigilosa');
    expect(res.body).not.toContain('43210');

    const [row] = await handle.db
      .select()
      .from(booking)
      .where(eq(booking.id, body.id));
    expect(row).toMatchObject({
      venueId: s.venueId,
      userId: p.userId,
      origin: 'app',
      status: 'held',
      totalCents: 20000,
    });
    expect(row?.priceBreakdown).toHaveLength(4);
  });

  it('ignora preço e campos extras enviados pelo cliente', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const res = await p.api.post(
      '/api/bookings',
      request(s, spDate(3), '09:00', 120, {
        totalCents: 1,
        priceCents: 1,
        status: 'confirmed',
        userId: ownerId,
        venueId: '00000000-0000-4000-8000-000000000000',
        holdExpiresAt: '2099-01-01T00:00:00.000Z',
      }),
    );
    expect(res.statusCode).toBe(201);
    const body = bookingSchema.parse(res.json());
    expect(body.totalCents).toBe(20000);
    expect(body.status).toBe('held');
    const [row] = await handle.db
      .select()
      .from(booking)
      .where(eq(booking.id, body.id));
    expect(row?.userId).not.toBe(ownerId);
    expect(row?.venueId).toBe(s.venueId);
    expect(row?.holdExpiresAt?.getFullYear()).toBeLessThan(2099);
  });

  it.each([
    [
      'sem corpo válido',
      { fieldId: 'x', startsAt: 'hoje', durationMinutes: 'a' },
    ],
    ['duração fora do passo', { durationMinutes: 45 }],
  ])('rejeita entrada malformada (%s)', async (_name, patch) => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const res = await p.api.post('/api/bookings', {
      ...request(s, spDate(3), '09:00', 60),
      ...patch,
    });
    expect(res.statusCode).toBe(422);
  });

  describe('validação de regras (422, pt-BR)', () => {
    const cases: [string, (s: SeededVenue) => object, RegExp][] = [
      ['past', (s) => request(s, spDate(-1), '09:00', 60), /já passou/],
      [
        'misaligned',
        (s) => request(s, spDate(3), '09:15', 60),
        /30 em 30 minutos/,
      ],
      [
        'too_short',
        (s) => request(s, spDate(3), '09:00', 30),
        /mínima.*60 minutos/,
      ],
      [
        'closed (antes de abrir)',
        (s) => request(s, spDate(3), '07:00', 60),
        /fechado/,
      ],
      [
        'closed (passa do fechamento)',
        (s) => request(s, spDate(3), '11:00', 120),
        /fechado/,
      ],
      ['too_far', (s) => request(s, spDate(61), '09:00', 60), /60 dias/],
    ];
    it.each(cases)('%s', async (_name, build, message) => {
      const s = await seedVenue(handle, ownerId);
      const p = await newPlayer();
      const res = await p.api.post('/api/bookings', build(s));
      expect(res.statusCode).toBe(422);
      expect(problem(res).detail).toMatch(message);
      const rows = await handle.db
        .select({ id: booking.id })
        .from(booking)
        .where(eq(booking.fieldId, s.fieldId));
      expect(rows).toHaveLength(0);
    });

    it('aceita o último dia do horizonte (hoje + 60)', async () => {
      const s = await seedVenue(handle, ownerId);
      const p = await newPlayer();
      const res = await p.api.post(
        '/api/bookings',
        request(s, spDate(60), '09:00', 60),
      );
      expect(res.statusCode).toBe(201);
    });
  });

  it('404 para quadra inexistente, inativa ou de espaço não publicado', async () => {
    const s = await seedVenue(handle, ownerId);
    const draft = await seedVenue(handle, ownerId, { status: 'draft' });
    const p = await newPlayer();
    const date = spDate(3);
    const unknown = await p.api.post('/api/bookings', {
      ...request(s, date, '09:00', 60),
      fieldId: '00000000-0000-4000-8000-000000000000',
    });
    expect(unknown.statusCode).toBe(404);
    const inactive = await p.api.post('/api/bookings', {
      ...request(s, date, '09:00', 60),
      fieldId: s.inactiveFieldId,
    });
    expect(inactive.statusCode).toBe(404);
    const unpublished = await p.api.post(
      '/api/bookings',
      request(draft, date, '09:00', 60),
    );
    expect(unpublished.statusCode).toBe(404);
  });

  it('409 se o horário já está reservado, confirmado ou bloqueado', async () => {
    const s = await seedVenue(handle, ownerId);
    const a = await newPlayer();
    const b = await newPlayer();
    const date = spDate(3);
    expect(
      (await a.api.post('/api/bookings', request(s, date, '08:00', 60)))
        .statusCode,
    ).toBe(201);
    const clash = await b.api.post(
      '/api/bookings',
      request(s, date, '08:30', 60),
    );
    expect(clash.statusCode).toBe(409);
    expect(problem(clash).detail).toBe('Esse horário acabou de ser reservado');

    await insertBooking(
      handle,
      s,
      ownerId,
      at(date, '09:00'),
      at(date, '10:00'),
      'confirmed',
    );
    expect(
      (await b.api.post('/api/bookings', request(s, date, '09:00', 60)))
        .statusCode,
    ).toBe(409);

    await handle.db.insert(availabilityBlock).values({
      fieldId: s.fieldId,
      period: { startsAt: at(date, '10:00'), endsAt: at(date, '11:00') },
      reason: 'Manutenção',
    });
    const blocked = await b.api.post(
      '/api/bookings',
      request(s, date, '10:00', 60),
    );
    expect(blocked.statusCode).toBe(409);
    expect(blocked.body).not.toContain('Manutenção');

    // Touching ranges are fine.
    expect(
      (await b.api.post('/api/bookings', request(s, date, '11:00', 60)))
        .statusCode,
    ).toBe(201);
  });

  it('EXCLUDE real: reserva concorrente invisível à checagem vira 409', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const rival = await newPlayer();
    const date = spDate(3);
    const raw = await handle.pool.connect();
    try {
      await raw.query('begin');
      // The FK checks would take share locks on the field row and make the
      // service wait at its own field lock instead; skip them (test superuser).
      await raw.query('set local session_replication_role = replica');
      const {
        rows: [self],
      } = await raw.query<{ pid: number }>('select pg_backend_pid() as pid');
      await raw.query(
        `insert into booking (field_id, venue_id, user_id, origin, status, period,
                              total_cents, price_breakdown, hold_expires_at)
         values ($1, $2, $3, 'app', 'held', tstzrange($4::timestamptz, $5::timestamptz, '[)'),
                 8000, '[]'::jsonb, now() + interval '10 minutes')`,
        [
          s.fieldId,
          s.venueId,
          rival.userId,
          at(date, '09:00').toISOString(),
          at(date, '10:00').toISOString(),
        ],
      );
      // Uncommitted: the service cannot see it, so its checks pass and its
      // insert waits on this transaction, then fails with 23P01.
      const pending = p.api.post(
        '/api/bookings',
        request(s, date, '09:00', 60),
      );
      let waiting = false;
      for (let attempt = 0; attempt < 100 && !waiting; attempt += 1) {
        const { rowCount } = await handle.pool.query(
          'select 1 from pg_stat_activity where $1 = any(pg_blocking_pids(pid))',
          [self?.pid],
        );
        waiting = (rowCount ?? 0) > 0;
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(waiting).toBe(true);
      await raw.query('commit');

      const res = await pending;
      expect(res.statusCode).toBe(409);
      expect(problem(res).detail).toBe('Esse horário acabou de ser reservado');
    } finally {
      await raw.query('rollback').catch(() => undefined);
      raw.release();
    }
    const rows = await handle.db
      .select({ userId: booking.userId })
      .from(booking)
      .where(eq(booking.fieldId, s.fieldId));
    expect(rows).toEqual([{ userId: rival.userId }]);
  });

  describe('concorrência', () => {
    it('10 jogadores no mesmo horário: 1 vence, 9 recebem 409', async () => {
      const s = await seedVenue(handle, ownerId);
      const players = await Promise.all(
        Array.from({ length: 10 }, () => newPlayer()),
      );
      const date = spDate(4);
      const results = await Promise.all(
        players.map((p) =>
          p.api.post('/api/bookings', request(s, date, '09:00', 60)),
        ),
      );
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([201, ...Array<number>(9).fill(409)]);
      for (const r of results.filter((x) => x.statusCode === 409)) {
        expect(problem(r).detail).toBe('Esse horário acabou de ser reservado');
      }
      const rows = await handle.db
        .select({ id: booking.id })
        .from(booking)
        .where(eq(booking.fieldId, s.fieldId));
      expect(rows).toHaveLength(1);
    });

    it('o mesmo jogador disparando 10 vezes: 1 reserva', async () => {
      const s = await seedVenue(handle, ownerId);
      const p = await newPlayer();
      const date = spDate(4);
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          p.api.post('/api/bookings', request(s, date, '09:00', 60)),
        ),
      );
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([201, ...Array<number>(9).fill(409)]);
    });

    it('janelas que se sobrepõem em parte: só uma passa', async () => {
      const s = await seedVenue(handle, ownerId);
      const players = await Promise.all(
        Array.from({ length: 6 }, () => newPlayer()),
      );
      const date = spDate(4);
      const windows = [
        ['08:00', 120],
        ['09:00', 120],
        ['10:00', 120],
        ['08:30', 60],
        ['09:30', 60],
        ['10:30', 60],
      ] as const;
      const results = await Promise.all(
        players.map((p, i) => {
          const [from, minutes] = windows[i] as readonly [string, number];
          return p.api.post('/api/bookings', request(s, date, from, minutes));
        }),
      );
      const created = results.filter((r) => r.statusCode === 201);
      expect(results.every((r) => [201, 409].includes(r.statusCode))).toBe(
        true,
      );
      expect(created.length).toBeGreaterThanOrEqual(1);
      // Whatever won, no two active bookings overlap.
      const rows = await handle.db
        .select({ period: booking.period })
        .from(booking)
        .where(eq(booking.fieldId, s.fieldId));
      expect(rows).toHaveLength(created.length);
      const sorted = rows
        .map((r) => r.period)
        .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]?.startsAt.getTime()).toBeGreaterThanOrEqual(
          sorted[i - 1]?.endsAt.getTime() ?? 0,
        );
      }
    });

    it('o limite de 3 holds vale também com pedidos simultâneos', async () => {
      const s = await seedVenue(handle, ownerId);
      const p = await newPlayer();
      const date = spDate(4);
      const starts = ['08:00', '09:00', '10:00', '11:00'];
      const results = await Promise.all(
        starts.map((from) =>
          p.api.post('/api/bookings', request(s, date, from, 60)),
        ),
      );
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([201, 201, 201, 422]);
    });
  });

  it('hold vencido libera o horário (relógio do banco)', async () => {
    const s = await seedVenue(handle, ownerId);
    const a = await newPlayer();
    const b = await newPlayer();
    const date = spDate(3);
    const first = bookingSchema.parse(
      (await a.api.post('/api/bookings', request(s, date, '09:00', 60))).json(),
    );
    expect(
      (await b.api.post('/api/bookings', request(s, date, '09:00', 60)))
        .statusCode,
    ).toBe(409);

    await expireHold(handle, first.id);
    const second = await b.api.post(
      '/api/bookings',
      request(s, date, '09:00', 60),
    );
    expect(second.statusCode).toBe(201);
    const [old] = await handle.db
      .select({ status: booking.status, cancelledBy: booking.cancelledBy })
      .from(booking)
      .where(eq(booking.id, first.id));
    // Same marks as the worker's expireHolds (cancelled_by = system).
    expect(old).toEqual({ status: 'expired', cancelledBy: 'system' });
  });

  it('no máximo 3 reservas aguardando pagamento por jogador', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const date = spDate(5);
    const ids: string[] = [];
    for (const from of ['08:00', '09:00', '10:00']) {
      const res = await p.api.post('/api/bookings', request(s, date, from, 60));
      expect(res.statusCode).toBe(201);
      ids.push(bookingSchema.parse(res.json()).id);
    }
    const fourth = await p.api.post(
      '/api/bookings',
      request(s, date, '11:00', 60),
    );
    expect(fourth.statusCode).toBe(422);
    expect(problem(fourth).detail).toBe(
      'Você já tem reservas aguardando pagamento',
    );
    // Another player is not affected.
    const other = await newPlayer();
    expect(
      (await other.api.post('/api/bookings', request(s, date, '11:00', 60)))
        .statusCode,
    ).toBe(201);

    // An expired hold does not count; neither does a cancelled one.
    await expireHold(handle, ids[0] ?? '');
    expect(
      (await p.api.post('/api/bookings', request(s, spDate(6), '08:00', 60)))
        .statusCode,
    ).toBe(201);
    expect(
      (await p.api.post('/api/bookings', request(s, spDate(6), '09:00', 60)))
        .statusCode,
    ).toBe(422);
    expect(
      (await p.api.post(`/api/bookings/${ids[1] ?? ''}/cancel`)).statusCode,
    ).toBe(200);
    expect(
      (await p.api.post('/api/bookings', request(s, spDate(6), '09:00', 60)))
        .statusCode,
    ).toBe(201);
  });
});

describe('GET /api/bookings/me e /:id', () => {
  it('lista as próximas primeiro e depois as passadas, só as do jogador', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const other = await newPlayer();
    const day = (n: number) => spDate(n);
    const farId = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, day(8), '09:00', 60))
      ).json(),
    ).id;
    const nearId = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, day(2), '09:00', 60))
      ).json(),
    ).id;
    const pastOld = await insertBooking(
      handle,
      s,
      p.userId,
      at(day(-10), '09:00'),
      at(day(-10), '10:00'),
      'confirmed',
    );
    const pastNew = await insertBooking(
      handle,
      s,
      p.userId,
      at(day(-2), '09:00'),
      at(day(-2), '10:00'),
      'confirmed',
    );
    await other.api.post('/api/bookings', request(s, day(9), '09:00', 60));

    const res = await p.api.get('/api/bookings/me');
    expect(res.statusCode).toBe(200);
    const list = bookingSchema.array().parse(res.json());
    expect(list.map((b) => b.id)).toEqual([nearId, farId, pastNew, pastOld]);
  });

  it('um hold vencido aparece como expirado mesmo antes da limpeza', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    await expireHold(handle, created.id);
    const one = bookingSchema.parse(
      (await p.api.get(`/api/bookings/${created.id}`)).json(),
    );
    expect(one.status).toBe('expired');
    expect(one.holdExpiresAt).toBeNull();
    const list = bookingSchema
      .array()
      .parse((await p.api.get('/api/bookings/me')).json());
    expect(list[0]?.status).toBe('expired');
  });

  it('reserva de outro jogador (ou id inválido): 404 em get, payment e cancel', async () => {
    const s = await seedVenue(handle, ownerId);
    const mine = await newPlayer();
    const thief = await newPlayer();
    const created = bookingSchema.parse(
      (
        await mine.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    for (const id of [
      created.id,
      'nao-e-uuid',
      '00000000-0000-4000-8000-000000000000',
    ]) {
      expect((await thief.api.get(`/api/bookings/${id}`)).statusCode).toBe(404);
      expect(
        (await thief.api.post(`/api/bookings/${id}/payment`)).statusCode,
      ).toBe(404);
      expect(
        (await thief.api.post(`/api/bookings/${id}/cancel`)).statusCode,
      ).toBe(404);
    }
    // Still intact.
    const [row] = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row?.status).toBe('held');
  });
});

describe('pagamento simulado e confirmação', () => {
  it('fluxo feliz: hold, cobrança, pagamento, reserva confirmada com endereço', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 120))
      ).json(),
    );
    const charge = await p.api.post(`/api/bookings/${created.id}/payment`);
    expect(charge.statusCode).toBe(201);
    const { chargeId } = charge.json<{ chargeId: string }>();

    // The webhook has no session cookie.
    const paid = await app.inject({
      method: 'POST',
      url: `/api/payments/fake/${chargeId}/pay`,
    });
    expect(paid.statusCode).toBe(200);
    expect(paid.json()).toEqual({ status: 'confirmed' });

    const after = bookingSchema.parse(
      (await p.api.get(`/api/bookings/${created.id}`)).json(),
    );
    expect(after.status).toBe('confirmed');
    expect(after.address).toEqual({
      street: 'Rua Sigilosa',
      number: '43210',
      complement: 'Fundos',
      cep: '01310100',
      phone: '(11) 98765-4321',
    });
    const [row] = await handle.db
      .select()
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row?.confirmedAt).toBeInstanceOf(Date);
    expect(row?.holdExpiresAt).toBeNull();
  });

  it('endereço e telefone só na reserva confirmada', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const date = spDate(3);
    const held = bookingSchema.parse(
      (await p.api.post('/api/bookings', request(s, date, '08:00', 60))).json(),
    );
    const toCancel = bookingSchema.parse(
      (await p.api.post('/api/bookings', request(s, date, '09:00', 60))).json(),
    );
    await p.api.post(`/api/bookings/${toCancel.id}/cancel`);
    const toExpire = bookingSchema.parse(
      (await p.api.post('/api/bookings', request(s, date, '10:00', 60))).json(),
    );
    await expireHold(handle, toExpire.id);
    const list = bookingSchema
      .array()
      .parse((await p.api.get('/api/bookings/me')).json());
    expect(list.map((b) => b.status).sort()).toEqual([
      'cancelled',
      'expired',
      'held',
    ]);
    for (const item of list) expect(item.address).toBeNull();
    const raw = (await p.api.get('/api/bookings/me')).body;
    expect(raw).not.toContain('98765-4321');
    expect(held.address).toBeNull();
  });

  it('é idempotente: pagar de novo continua confirmada', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    const { chargeId } = (
      await p.api.post(`/api/bookings/${created.id}/payment`)
    ).json<{ chargeId: string }>();
    const url = `/api/payments/fake/${chargeId}/pay`;
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(200);
    const [first] = await handle.db
      .select({ confirmedAt: booking.confirmedAt })
      .from(booking)
      .where(eq(booking.id, created.id));
    expect((await app.inject({ method: 'POST', url })).statusCode).toBe(200);
    const [second] = await handle.db
      .select({ confirmedAt: booking.confirmedAt })
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(second?.confirmedAt).toEqual(first?.confirmedAt);
  });

  it('hold vencido: pagar dá 409 e a reserva fica expirada', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    const { chargeId } = (
      await p.api.post(`/api/bookings/${created.id}/payment`)
    ).json<{ chargeId: string }>();
    await expireHold(handle, created.id);

    const paid = await app.inject({
      method: 'POST',
      url: `/api/payments/fake/${chargeId}/pay`,
    });
    expect(paid.statusCode).toBe(409);
    expect(problem(paid).detail).toBe('O prazo para pagamento acabou');
    const [row] = await handle.db
      .select({ status: booking.status, cancelledBy: booking.cancelledBy })
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row).toEqual({ status: 'expired', cancelledBy: 'system' });
    // The slot is free again.
    const other = await newPlayer();
    expect(
      (
        await other.api.post(
          '/api/bookings',
          request(s, spDate(3), '09:00', 60),
        )
      ).statusCode,
    ).toBe(201);
  });

  it('não paga reserva cancelada nem cobrança desconhecida', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    const { chargeId } = (
      await p.api.post(`/api/bookings/${created.id}/payment`)
    ).json<{ chargeId: string }>();
    expect(
      (await p.api.post(`/api/bookings/${created.id}/cancel`)).statusCode,
    ).toBe(200);
    const paid = await app.inject({
      method: 'POST',
      url: `/api/payments/fake/${chargeId}/pay`,
    });
    expect(paid.statusCode).toBe(409);
    for (const id of [
      'lixo',
      'fake_lixo',
      'fake_00000000-0000-4000-8000-000000000000',
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/payments/fake/${id}/pay`,
      });
      expect(res.statusCode).toBe(404);
    }
    const [row] = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row?.status).toBe('cancelled');
  });

  it('pagar e cancelar ao mesmo tempo termina em um estado só', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    const { chargeId } = (
      await p.api.post(`/api/bookings/${created.id}/payment`)
    ).json<{ chargeId: string }>();
    const [pay, cancel] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/payments/fake/${chargeId}/pay` }),
      p.api.post(`/api/bookings/${created.id}/cancel`),
    ]);
    const [row] = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, created.id));
    // Either order is valid (pay, then cancel with 24h+ notice; or cancel
    // first and the payment is refused), but never a half state.
    if (row?.status === 'confirmed') {
      expect(pay.statusCode).toBe(200);
      expect(cancel.statusCode).toBe(409);
    } else {
      expect(row?.status).toBe('cancelled');
      expect(cancel.statusCode).toBe(200);
      expect([200, 409]).toContain(pay.statusCode);
    }
  });
});

describe('POST /api/bookings/:id/cancel', () => {
  it('cancela um hold e libera o horário', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const other = await newPlayer();
    const date = spDate(3);
    const created = bookingSchema.parse(
      (await p.api.post('/api/bookings', request(s, date, '09:00', 60))).json(),
    );
    const res = await p.api.post(`/api/bookings/${created.id}/cancel`);
    expect(res.statusCode).toBe(200);
    const body = cancelBookingResponseSchema.parse(res.json());
    expect(body.booking.status).toBe('cancelled');
    const [row] = await handle.db
      .select()
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row).toMatchObject({ status: 'cancelled', cancelledBy: 'player' });
    expect(row?.cancelledAt).toBeInstanceOf(Date);
    expect(
      (await other.api.post('/api/bookings', request(s, date, '09:00', 60)))
        .statusCode,
    ).toBe(201);
    // Cancelling twice is a conflict.
    expect(
      (await p.api.post(`/api/bookings/${created.id}/cancel`)).statusCode,
    ).toBe(409);
  });

  it('confirmada: cancela com 24h ou mais de antecedência, avisa do reembolso', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const id = await insertBooking(
      handle,
      s,
      p.userId,
      new Date(Date.now() + 25 * 60 * MIN),
      new Date(Date.now() + 26 * 60 * MIN),
      'confirmed',
    );
    const res = await p.api.post(`/api/bookings/${id}/cancel`);
    expect(res.statusCode).toBe(200);
    const body = cancelBookingResponseSchema.parse(res.json());
    expect(body.message).toBe(
      'Cancelada. O reembolso será tratado pelo suporte.',
    );
    expect(body.booking.status).toBe('cancelled');
  });

  it('confirmada com menos de 24h (ou já passada): 409 e nada muda', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const soon = await insertBooking(
      handle,
      s,
      p.userId,
      new Date(Date.now() + 23 * 60 * MIN),
      new Date(Date.now() + 24 * 60 * MIN),
      'confirmed',
    );
    const past = await insertBooking(
      handle,
      s,
      p.userId,
      new Date(Date.now() - 5 * 60 * MIN),
      new Date(Date.now() - 4 * 60 * MIN),
      'confirmed',
    );
    for (const id of [soon, past]) {
      const res = await p.api.post(`/api/bookings/${id}/cancel`);
      expect(res.statusCode).toBe(409);
      expect(problem(res).detail).toMatch(/24 horas/);
      const [row] = await handle.db
        .select({ status: booking.status })
        .from(booking)
        .where(eq(booking.id, id));
      expect(row?.status).toBe('confirmed');
    }
  });

  it('hold já vencido não pode ser cancelado (está expirado)', async () => {
    const s = await seedVenue(handle, ownerId);
    const p = await newPlayer();
    const created = bookingSchema.parse(
      (
        await p.api.post('/api/bookings', request(s, spDate(3), '09:00', 60))
      ).json(),
    );
    await expireHold(handle, created.id);
    expect(
      (await p.api.post(`/api/bookings/${created.id}/cancel`)).statusCode,
    ).toBe(409);
  });
});
