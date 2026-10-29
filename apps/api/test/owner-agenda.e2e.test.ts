import {
  agendaBookingSchema,
  availabilitySchema,
  ownerAgendaSchema,
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

const { booking, availabilityBlock, field, venue } = schema;

let app: NestFastifyApplication;
let handle: DbHandle;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
});

afterAll(async () => {
  await app.close();
});

interface Person {
  userId: string;
  api: AsUser;
}

async function newPerson(name: string): Promise<Person> {
  const { cookie, userId } = await signUpAs(app, name);
  return { userId, api: asUser(app, cookie) };
}

/** An owner with a published venue (open 08-12, Quadra A + an inactive one). */
async function newOwnerVenue(): Promise<{ owner: Person; s: SeededVenue }> {
  const owner = await newPerson('Dona Arena');
  return { owner, s: await seedVenue(handle, owner.userId) };
}

const problem = (res: LightMyRequestResponse): Problem => res.json<Problem>();
const HOUR = 3_600_000;
const MIN = 60_000;

function manual(
  date: string,
  from: string,
  minutes: number,
  extra: object = {},
) {
  return {
    startsAt: at(date, from).toISOString(),
    durationMinutes: minutes,
    customerName: 'Carlos Silva',
    ...extra,
  };
}

const manualUrl = (s: SeededVenue): string =>
  `/api/owner/fields/${s.fieldId}/bookings`;
const blocksUrl = (s: SeededVenue): string =>
  `/api/owner/fields/${s.fieldId}/blocks`;

async function activeBookings(fieldId: string): Promise<number> {
  const rows = await handle.db
    .select({ status: booking.status })
    .from(booking)
    .where(eq(booking.fieldId, fieldId));
  return rows.filter(
    (row) => row.status === 'confirmed' || row.status === 'held',
  ).length;
}

describe('GET /api/owner/venues/:id/agenda', () => {
  it('mostra reserva do app, manual e bloqueio, sem dados privados do jogador', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Joana Maria Jogadora');
    const date = spDate(3);
    const held = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '08:00'),
      at(date, '09:00'),
      'held',
      new Date(Date.now() + 10 * MIN),
    );
    const created = await owner.api.post(
      manualUrl(s),
      manual(date, '09:00', 60, { customerPhone: '(11) 98765-4321' }),
    );
    expect(created.statusCode).toBe(201);
    const blockRes = await owner.api.post(blocksUrl(s), {
      startsAt: at(date, '11:00').toISOString(),
      endsAt: at(date, '12:00').toISOString(),
      reason: 'Manutenção',
    });
    expect(blockRes.statusCode).toBe(201);
    // Closed ones are not on the agenda.
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '10:00'),
      at(date, '11:00'),
      'cancelled',
    );

    const res = await owner.api.get(
      `/api/owner/venues/${s.venueId}/agenda?date=${date}`,
    );
    expect(res.statusCode).toBe(200);
    const agenda = ownerAgendaSchema.parse(res.json());
    expect(agenda.date).toBe(date);
    expect(agenda.timezone).toBe('America/Sao_Paulo');
    const quadra = agenda.fields.find((f) => f.id === s.fieldId);
    expect(quadra?.items).toHaveLength(3);
    const [first, second, third] = quadra?.items ?? [];
    expect(first).toMatchObject({
      kind: 'booking',
      id: held,
      status: 'held',
      origin: 'app',
      customerName: 'Joana J.',
      customerPhone: null,
    });
    expect(second).toMatchObject({
      kind: 'booking',
      status: 'confirmed',
      origin: 'manual',
      customerName: 'Carlos Silva',
      customerPhone: '+5511987654321',
      totalCents: 8000,
    });
    expect(third).toMatchObject({ kind: 'block', reason: 'Manutenção' });
    // Nothing identifying the player beyond the short name.
    expect(res.body).not.toContain(player.userId);
    expect(res.body).not.toContain('@');
    expect(res.body).not.toContain('Maria');
  });

  it('uma reserva que passa da meia-noite aparece nos dois dias', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Pedro');
    const date = spDate(4);
    const next = spDate(5);
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '23:00'),
      at(next, '01:00'),
      'confirmed',
    );
    for (const day of [date, next]) {
      const agenda = ownerAgendaSchema.parse(
        (
          await owner.api.get(
            `/api/owner/venues/${s.venueId}/agenda?date=${day}`,
          )
        ).json(),
      );
      expect(agenda.fields.find((f) => f.id === s.fieldId)?.items).toHaveLength(
        1,
      );
    }
  });

  it('exige login, data válida e dono; outro dono recebe 404', async () => {
    const { owner, s } = await newOwnerVenue();
    const stranger = await newPerson('Outro Dono');
    const url = `/api/owner/venues/${s.venueId}/agenda?date=${spDate(1)}`;
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect((await stranger.api.get(url)).statusCode).toBe(404);
    expect(
      (
        await stranger.api.get(
          '/api/owner/venues/nao-e-uuid/agenda?date=2030-01-01',
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await owner.api.get(
          `/api/owner/venues/${s.venueId}/agenda?date=2030-02-30`,
        )
      ).statusCode,
    ).toBe(422);
    expect(
      (await owner.api.get(`/api/owner/venues/${s.venueId}/agenda`)).statusCode,
    ).toBe(422);
  });
});

describe('POST /api/owner/fields/:id/bookings', () => {
  it('cria reserva manual confirmada com preço do servidor e tira o horário da disponibilidade', async () => {
    const { owner, s } = await newOwnerVenue();
    const date = spDate(2);
    const res = await owner.api.post(manualUrl(s), {
      ...manual(date, '09:00', 120),
      totalCents: 1,
      status: 'held',
      origin: 'app',
    });
    expect(res.statusCode).toBe(201);
    const created = agendaBookingSchema.parse(res.json());
    expect(created).toMatchObject({
      status: 'confirmed',
      origin: 'manual',
      totalCents: 20000,
      customerName: 'Carlos Silva',
      customerPhone: null,
    });
    const [row] = await handle.db
      .select()
      .from(booking)
      .where(eq(booking.id, created.id));
    expect(row).toMatchObject({
      userId: null,
      venueId: s.venueId,
      origin: 'manual',
      status: 'confirmed',
      holdExpiresAt: null,
    });
    expect(row?.confirmedAt).toBeInstanceOf(Date);

    const availability = availabilitySchema.parse(
      (
        await app.inject({
          method: 'GET',
          url: `/api/venues/${s.slug}/availability?date=${date}`,
        })
      ).json(),
    );
    const slots = availability.fields.find((f) => f.id === s.fieldId)?.slots;
    expect(
      slots?.filter((slot) => !slot.available).map((slot) => slot.startsAt),
    ).toEqual(
      expect.arrayContaining([
        at(date, '09:00').toISOString(),
        at(date, '10:00').toISOString(),
      ]),
    );
  });

  it('conflito com reserva, hold vivo ou bloqueio dá 409; hold vencido não impede', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Jogador');
    const date = spDate(3);
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '08:00'),
      at(date, '09:00'),
      'confirmed',
    );
    const live = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '09:00'),
      at(date, '10:00'),
      'held',
      new Date(Date.now() + 5 * MIN),
    );
    await owner.api.post(blocksUrl(s), {
      startsAt: at(date, '10:00').toISOString(),
      endsAt: at(date, '11:00').toISOString(),
    });
    for (const from of ['08:00', '09:00', '10:00']) {
      const res = await owner.api.post(manualUrl(s), manual(date, from, 60));
      expect(res.statusCode).toBe(409);
    }
    expect(await activeBookings(s.fieldId)).toBe(2);

    await expireHold(handle, live);
    const free = await owner.api.post(manualUrl(s), manual(date, '09:00', 60));
    expect(free.statusCode).toBe(201);
    // The stale hold was cleaned the same way the worker does it.
    const [old] = await handle.db
      .select({ status: booking.status, cancelledBy: booking.cancelledBy })
      .from(booking)
      .where(eq(booking.id, live));
    expect(old).toEqual({ status: 'expired', cancelledBy: 'system' });
  });

  it('valida como o jogador (passado, fechado, passo de 30 min) e exige o nome', async () => {
    const { owner, s } = await newOwnerVenue();
    const date = spDate(2);
    const past = await owner.api.post(
      manualUrl(s),
      manual(spDate(-1), '09:00', 60),
    );
    expect(past.statusCode).toBe(422);
    expect(problem(past).errors?.startsAt).toBeDefined();
    const closed = await owner.api.post(
      manualUrl(s),
      manual(date, '13:00', 60),
    );
    expect(closed.statusCode).toBe(422);
    const short = await owner.api.post(manualUrl(s), manual(date, '09:00', 30));
    expect(short.statusCode).toBe(422);
    const noName = await owner.api.post(manualUrl(s), {
      startsAt: at(date, '09:00').toISOString(),
      durationMinutes: 60,
    });
    expect(noName.statusCode).toBe(422);
    expect(problem(noName).errors?.customerName).toBeDefined();
    const blank = await owner.api.post(
      manualUrl(s),
      manual(date, '09:00', 60, { customerName: '   ' }),
    );
    expect(blank.statusCode).toBe(422);
    expect(await activeBookings(s.fieldId)).toBe(0);
  });

  it('quadra de outro dono, inexistente ou inativa não aceita', async () => {
    const { owner, s } = await newOwnerVenue();
    const stranger = await newPerson('Intruso');
    const date = spDate(2);
    expect(
      (await stranger.api.post(manualUrl(s), manual(date, '09:00', 60)))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await owner.api.post(
          '/api/owner/fields/nao-e-uuid/bookings',
          manual(date, '09:00', 60),
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: manualUrl(s),
          payload: manual(date, '09:00', 60),
        })
      ).statusCode,
    ).toBe(401);
    const inactive = await owner.api.post(
      `/api/owner/fields/${s.inactiveFieldId}/bookings`,
      manual(date, '09:00', 60),
    );
    expect(inactive.statusCode).toBe(422);
    expect(await activeBookings(s.fieldId)).toBe(0);
  });

  it('dono e jogador disputando o mesmo horário: só um vence', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Corredor');
    const date = spDate(6);
    const [a, b, c] = await Promise.all([
      owner.api.post(manualUrl(s), manual(date, '08:00', 60)),
      player.api.post('/api/bookings', {
        fieldId: s.fieldId,
        startsAt: at(date, '08:00').toISOString(),
        durationMinutes: 60,
      }),
      owner.api.post(manualUrl(s), manual(date, '08:00', 60)),
    ]);
    const codes = [a, b, c].map((res) => res.statusCode).sort();
    expect(codes).toEqual([201, 409, 409]);
    expect(await activeBookings(s.fieldId)).toBe(1);
  });

  it('reserva manual e bloqueio simultâneos no mesmo horário: só um vence', async () => {
    const { owner, s } = await newOwnerVenue();
    const date = spDate(7);
    const results = await Promise.all([
      owner.api.post(manualUrl(s), manual(date, '10:00', 60)),
      owner.api.post(blocksUrl(s), {
        startsAt: at(date, '10:00').toISOString(),
        endsAt: at(date, '11:00').toISOString(),
      }),
    ]);
    expect(results.map((res) => res.statusCode).sort()).toEqual([201, 409]);
    const blocks = await handle.db
      .select({ id: availabilityBlock.id })
      .from(availabilityBlock)
      .where(eq(availabilityBlock.fieldId, s.fieldId));
    expect(blocks.length + (await activeBookings(s.fieldId))).toBe(1);
  });
});

describe('POST /api/owner/bookings/:id/cancel', () => {
  it('cancela reserva manual, hold e paga futuras (cancelled_by = owner) e libera o horário', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Jogador');
    const date = spDate(3);
    const man = agendaBookingSchema.parse(
      (await owner.api.post(manualUrl(s), manual(date, '08:00', 60))).json(),
    );
    const held = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '09:00'),
      at(date, '10:00'),
      'held',
      new Date(Date.now() + 5 * MIN),
    );
    const paid = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '10:00'),
      at(date, '11:00'),
      'confirmed',
    );
    for (const id of [man.id, held, paid]) {
      const res = await owner.api.post(`/api/owner/bookings/${id}/cancel`);
      expect(res.statusCode).toBe(200);
      expect(agendaBookingSchema.parse(res.json()).status).toBe('cancelled');
      const [row] = await handle.db
        .select({
          status: booking.status,
          by: booking.cancelledBy,
          at: booking.cancelledAt,
        })
        .from(booking)
        .where(eq(booking.id, id));
      expect(row).toMatchObject({ status: 'cancelled', by: 'owner' });
      expect(row?.at).toBeInstanceOf(Date);
    }
    // The slot is free again.
    expect(
      (await owner.api.post(manualUrl(s), manual(date, '08:00', 60)))
        .statusCode,
    ).toBe(201);
  });

  it('já encerrada, vencida ou passada: 409; outro dono e id ruim: 404', async () => {
    const { owner, s } = await newOwnerVenue();
    const stranger = await newPerson('Intruso');
    const player = await newPerson('Jogador');
    const date = spDate(3);
    const cancelled = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '08:00'),
      at(date, '09:00'),
      'cancelled',
    );
    const stale = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '09:00'),
      at(date, '10:00'),
      'held',
      new Date(Date.now() - MIN),
    );
    const past = await insertBooking(
      handle,
      s,
      player.userId,
      new Date(Date.now() - 3 * HOUR),
      new Date(Date.now() - 2 * HOUR),
      'confirmed',
    );
    const live = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '10:00'),
      at(date, '11:00'),
      'confirmed',
    );
    for (const id of [cancelled, stale, past]) {
      const res = await owner.api.post(`/api/owner/bookings/${id}/cancel`);
      expect(res.statusCode).toBe(409);
      expect(problem(res).detail).toBe('Essa reserva não pode ser cancelada');
    }
    expect(
      (await stranger.api.post(`/api/owner/bookings/${live}/cancel`))
        .statusCode,
    ).toBe(404);
    expect(
      (await owner.api.post('/api/owner/bookings/xyz/cancel')).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/owner/bookings/${live}/cancel`,
        })
      ).statusCode,
    ).toBe(401);
    const [row] = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, live));
    expect(row?.status).toBe('confirmed');
  });
});

describe('regras com reservas futuras', () => {
  async function withFutureBooking(kind: 'confirmed' | 'live-hold') {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Jogador');
    const date = spDate(4);
    const id = await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '09:00'),
      at(date, '10:00'),
      kind === 'confirmed' ? 'confirmed' : 'held',
      kind === 'confirmed' ? null : new Date(Date.now() + 5 * MIN),
    );
    return { owner, s, player, date, id };
  }

  it.each(['confirmed', 'live-hold'] as const)(
    'apagar quadra com reserva futura (%s): 409 e nada muda',
    async (kind) => {
      const { owner, s, id } = await withFutureBooking(kind);
      const res = await owner.api.del(`/api/owner/fields/${s.fieldId}`);
      expect(res.statusCode).toBe(409);
      expect(problem(res).detail).toBe('Esta quadra tem reservas futuras');
      const [stillThere] = await handle.db
        .select({ id: field.id })
        .from(field)
        .where(eq(field.id, s.fieldId));
      expect(stillThere).toBeDefined();
      const [row] = await handle.db
        .select({ status: booking.status })
        .from(booking)
        .where(eq(booking.id, id));
      expect(row?.status).toBe(kind === 'confirmed' ? 'confirmed' : 'held');
    },
  );

  it('desativar quadra com reserva futura: 409 e segue ativa; renomear segue livre', async () => {
    const { owner, s } = await withFutureBooking('confirmed');
    // A draft venue (the seed has no photo) may change freely.
    await handle.db
      .update(venue)
      .set({ status: 'draft' })
      .where(eq(venue.id, s.venueId));
    const res = await owner.api.patch(`/api/owner/fields/${s.fieldId}`, {
      isActive: false,
    });
    expect(res.statusCode).toBe(409);
    expect(problem(res).detail).toBe('Esta quadra tem reservas futuras');
    const [row] = await handle.db
      .select({ isActive: field.isActive })
      .from(field)
      .where(eq(field.id, s.fieldId));
    expect(row?.isActive).toBe(true);
    const rename = await owner.api.patch(`/api/owner/fields/${s.fieldId}`, {
      name: 'Quadra Renomeada',
      isActive: true,
    });
    expect(rename.statusCode, rename.body).toBe(200);
  });

  it('apagar espaço com reserva futura: 409 e nada muda', async () => {
    const { owner, s, id } = await withFutureBooking('confirmed');
    const res = await owner.api.del(`/api/owner/venues/${s.venueId}`);
    expect(res.statusCode).toBe(409);
    expect(problem(res).detail).toBe('Este espaço tem reservas futuras');
    const [v] = await handle.db
      .select({ status: venue.status })
      .from(venue)
      .where(eq(venue.id, s.venueId));
    expect(v?.status).toBe('published');
    const [row] = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(eq(booking.id, id));
    expect(row?.status).toBe('confirmed');
  });

  it('despublicar espaço com reserva futura: 409 e segue publicado', async () => {
    const { owner, s } = await withFutureBooking('live-hold');
    const res = await owner.api.post(
      `/api/owner/venues/${s.venueId}/unpublish`,
    );
    expect(res.statusCode).toBe(409);
    expect(problem(res).detail).toBe('Este espaço tem reservas futuras');
    const [v] = await handle.db
      .select({ status: venue.status })
      .from(venue)
      .where(eq(venue.id, s.venueId));
    expect(v?.status).toBe('published');
  });

  it('bloqueio sobre reserva ativa: 409 e nenhum bloqueio; sobre hold vencido ou cancelada, passa', async () => {
    const { owner, s, date } = await withFutureBooking('confirmed');
    const over = await owner.api.post(blocksUrl(s), {
      startsAt: at(date, '08:30').toISOString(),
      endsAt: at(date, '09:30').toISOString(),
    });
    expect(over.statusCode).toBe(409);
    expect(problem(over).detail).toBe('Já existe uma reserva nesse período');
    const none = await handle.db
      .select({ id: availabilityBlock.id })
      .from(availabilityBlock)
      .where(eq(availabilityBlock.fieldId, s.fieldId));
    expect(none).toHaveLength(0);

    const player = await newPerson('Outro');
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '10:00'),
      at(date, '11:00'),
      'held',
      new Date(Date.now() - MIN),
    );
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '11:00'),
      at(date, '12:00'),
      'cancelled',
    );
    // Touching the confirmed 09:00-10:00 booking is not an overlap.
    const ok = await owner.api.post(blocksUrl(s), {
      startsAt: at(date, '10:00').toISOString(),
      endsAt: at(date, '12:00').toISOString(),
    });
    expect(ok.statusCode).toBe(201);
  });

  it('só histórico sem pagamento (cancelada, hold vencido) não impede apagar quadra e espaço', async () => {
    const { owner, s } = await newOwnerVenue();
    const player = await newPerson('Jogador');
    const date = spDate(4);
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '08:00'),
      at(date, '09:00'),
      'cancelled',
    );
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '09:00'),
      at(date, '10:00'),
      'held',
      new Date(Date.now() - MIN),
    );
    await insertBooking(
      handle,
      s,
      player.userId,
      at(date, '10:00'),
      at(date, '11:00'),
      'expired',
    );
    // Quadra A is the only active field of a published venue: unpublish first.
    expect(
      (await owner.api.post(`/api/owner/venues/${s.venueId}/unpublish`))
        .statusCode,
    ).toBe(200);
    expect(
      (await owner.api.del(`/api/owner/fields/${s.fieldId}`)).statusCode,
    ).toBe(204);
    expect(
      (await owner.api.del(`/api/owner/venues/${s.venueId}`)).statusCode,
    ).toBe(204);
    const left = await handle.db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.venueId, s.venueId));
    expect(left).toHaveLength(0);
  });

  describe('histórico pago nunca é apagado', () => {
    async function withPaidHistory(kind: 'past-confirmed' | 'cancelled-paid') {
      const { owner, s } = await newOwnerVenue();
      const player = await newPerson('Jogador');
      const past = [
        new Date(Date.now() - 3 * HOUR),
        new Date(Date.now() - 2 * HOUR),
      ] as const;
      const id = await insertBooking(
        handle,
        s,
        player.userId,
        past[0],
        past[1],
        'confirmed',
      );
      if (kind === 'cancelled-paid') {
        await handle.db
          .update(booking)
          .set({
            status: 'cancelled',
            cancelledBy: 'owner',
            cancelledAt: new Date(),
          })
          .where(eq(booking.id, id));
      }
      await owner.api.post(`/api/owner/venues/${s.venueId}/unpublish`);
      return { owner, s, id };
    }

    it.each(['past-confirmed', 'cancelled-paid'] as const)(
      'quadra (%s): 409 e a reserva continua',
      async (kind) => {
        const { owner, s, id } = await withPaidHistory(kind);
        const res = await owner.api.del(`/api/owner/fields/${s.fieldId}`);
        expect(res.statusCode).toBe(409);
        expect(problem(res).detail).toBe(
          'Esta quadra tem histórico de reservas pagas. Desative-a em vez de excluir.',
        );
        const [row] = await handle.db
          .select({ id: booking.id })
          .from(booking)
          .where(eq(booking.id, id));
        expect(row).toBeDefined();
        const [f] = await handle.db
          .select({ id: field.id })
          .from(field)
          .where(eq(field.id, s.fieldId));
        expect(f).toBeDefined();
      },
    );

    it.each(['past-confirmed', 'cancelled-paid'] as const)(
      'espaço (%s): 409 e tudo continua',
      async (kind) => {
        const { owner, s, id } = await withPaidHistory(kind);
        const res = await owner.api.del(`/api/owner/venues/${s.venueId}`);
        expect(res.statusCode).toBe(409);
        expect(problem(res).detail).toBe(
          'Este espaço tem histórico de reservas pagas. Despublique-o em vez de excluir.',
        );
        const [v] = await handle.db
          .select({ id: venue.id })
          .from(venue)
          .where(eq(venue.id, s.venueId));
        expect(v).toBeDefined();
        const [row] = await handle.db
          .select({ id: booking.id })
          .from(booking)
          .where(eq(booking.id, id));
        expect(row).toBeDefined();
      },
    );

    it('desativar a quadra (e despublicar) segue permitido', async () => {
      const { owner, s } = await withPaidHistory('past-confirmed');
      const res = await owner.api.patch(`/api/owner/fields/${s.fieldId}`, {
        isActive: false,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  it('desativar quadra com reserva futura em espaço publicado: 409 (não 422) e segue ativa', async () => {
    const { owner, s } = await withFutureBooking('confirmed');
    const res = await owner.api.patch(`/api/owner/fields/${s.fieldId}`, {
      isActive: false,
    });
    expect(res.statusCode).toBe(409);
    const [row] = await handle.db
      .select({ isActive: field.isActive })
      .from(field)
      .where(eq(field.id, s.fieldId));
    expect(row?.isActive).toBe(true);
  });

  it('apagar outra quadra do espaço é permitido mesmo que uma irmã tenha reserva futura', async () => {
    const { owner, s } = await withFutureBooking('confirmed');
    // The seed has no photo, so a published venue could not change at all.
    await handle.db
      .update(venue)
      .set({ status: 'draft' })
      .where(eq(venue.id, s.venueId));
    const res = await owner.api.del(`/api/owner/fields/${s.inactiveFieldId}`);
    expect(res.statusCode).toBe(204);
    expect(await activeBookings(s.fieldId)).toBe(1);
  });

  it('apagar quadra/espaço e reservar ao mesmo tempo: ou a reserva vence (409 ao apagar) ou o apagar vence (404 ao reservar), sem deadlock', async () => {
    for (let round = 0; round < 6; round += 1) {
      const { owner, s } = await newOwnerVenue();
      const date = spDate(8);
      // Draft venue so the field delete is not stopped by the published rule.
      await owner.api.post(`/api/owner/venues/${s.venueId}/unpublish`);
      const target = round % 2 === 0 ? 'fields' : 'venues';
      const id = round % 2 === 0 ? s.fieldId : s.venueId;
      const [del, book] = await Promise.all([
        owner.api.del(`/api/owner/${target}/${id}`),
        owner.api.post(manualUrl(s), manual(date, '09:00', 60)),
      ]);
      if (book.statusCode === 201) {
        expect(del.statusCode, del.body).toBe(409);
        expect(await activeBookings(s.fieldId)).toBe(1);
      } else {
        expect(book.statusCode, book.body).toBe(404);
        expect(del.statusCode, del.body).toBe(204);
      }
    }
  });
});
