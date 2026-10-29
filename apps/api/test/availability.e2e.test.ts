import { randomUUID } from 'node:crypto';
import {
  availabilitySchema,
  type AvailabilitySlot,
  type Problem,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { buildTestApp, signUpAs, uniqueToken } from './helpers.js';

const { venue, venueHours, field, priceRule, availabilityBlock, booking } =
  schema;

let app: NestFastifyApplication;
let handle: DbHandle;
let ownerId: string;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
  ({ userId: ownerId } = await signUpAs(app, 'Maria Silva Souza'));
});

afterAll(async () => {
  await app.close();
});

const get = (url: string): Promise<LightMyRequestResponse> =>
  app.inject({ method: 'GET', url });

const DAY_MS = 86_400_000;

/** Local calendar date (YYYY-MM-DD) of an instant in a zone. */
function localDate(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Today in the zone plus `days` calendar days. */
function dateIn(timezone: string, days: number): string {
  const [y, m, d] = localDate(new Date(), timezone).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

const SP = 'America/Sao_Paulo';
/** Brazil has no DST now: America/Sao_Paulo is UTC-3 all year. */
const at = (date: string, hhmm: string): Date =>
  new Date(`${date}T${hhmm}:00-03:00`);

interface SeededVenue {
  slug: string;
  venueId: string;
  fieldId: string;
  otherFieldId: string;
  inactiveFieldId: string;
}

/** A venue open 08:00-12:00 every day with two active fields and one inactive. */
async function seed(
  opts: {
    status?: 'draft' | 'published';
    timezone?: string;
    allDay?: boolean;
  } = {},
): Promise<SeededVenue> {
  const token = uniqueToken();
  const [v] = await handle.db
    .insert(venue)
    .values({
      ownerId,
      slug: `disp-${token}-${randomUUID().slice(0, 4)}`,
      name: `Arena Disp ${token}`,
      phone: '(11) 98765-4321',
      cep: '01310100',
      street: 'Rua Sigilosa',
      number: '43210',
      neighborhood: `Bairro ${token}`,
      city: 'Cidade Teste',
      state: 'SP',
      location: { lat: -23.55678, lng: -46.69123 },
      amenities: [],
      cancellationPolicy: 'flexivel',
      timezone: opts.timezone ?? SP,
      status: opts.status ?? 'published',
    })
    .returning({ id: venue.id, slug: venue.slug });
  if (!v) throw new Error('seed falhou');
  await handle.db.insert(venueHours).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      venueId: v.id,
      weekday,
      openMinute: opts.allDay ? 0 : 480,
      closeMinute: opts.allDay ? 1440 : 720,
    })),
  );
  const mk = async (name: string, isActive: boolean): Promise<string> => {
    const [f] = await handle.db
      .insert(field)
      .values({
        venueId: v.id,
        name,
        sports: ['futsal'],
        surface: 'piso_rigido',
        minSlotMinutes: 60,
        basePriceCentsPerHour: 8000,
        isActive,
      })
      .returning({ id: field.id });
    if (!f) throw new Error('seed de quadra falhou');
    return f.id;
  };
  const fieldId = await mk('Quadra A', true);
  const otherFieldId = await mk('Quadra B', true);
  const inactiveFieldId = await mk('Quadra Inativa', false);
  // 10:00-12:00 costs more on Quadra A.
  await handle.db.insert(priceRule).values({
    fieldId,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    startMinute: 600,
    endMinute: 720,
    priceCentsPerHour: 12000,
  });
  return {
    slug: v.slug,
    venueId: v.id,
    fieldId,
    otherFieldId,
    inactiveFieldId,
  };
}

async function book(
  seeded: SeededVenue,
  fieldId: string,
  start: Date,
  end: Date,
  status: 'held' | 'confirmed' | 'cancelled' | 'expired',
  holdExpiresAt: Date | null,
): Promise<void> {
  await handle.db.insert(booking).values({
    fieldId,
    venueId: seeded.venueId,
    userId: ownerId,
    origin: 'app',
    status,
    period: { startsAt: start, endsAt: end },
    totalCents: 8000,
    priceBreakdown: [],
    holdExpiresAt,
    customerName: 'Cliente Secreto',
    customerPhone: '(11) 90000-0000',
    confirmedAt: status === 'confirmed' ? new Date() : null,
  });
}

const ok = (res: LightMyRequestResponse) => {
  expect(res.statusCode).toBe(200);
  return availabilitySchema.parse(res.json());
};

const hhmmZ = (slot: AvailabilitySlot): string =>
  new Date(slot.startsAt).toISOString().slice(11, 16);

describe('GET /api/venues/:slug/availability', () => {
  it('lista os horários do dia com faixa de preço, bloqueio e reservas', async () => {
    const s = await seed();
    const date = dateIn(SP, 3);
    const future = new Date(Date.now() + 3600_000);
    // 08:00-09:00 held (live), 09:00-10:00 block, 10:00-11:00 confirmed,
    // 11:00-12:00 held but expired; cancelled rows never count.
    await book(
      s,
      s.fieldId,
      at(date, '08:00'),
      at(date, '09:00'),
      'held',
      future,
    );
    await handle.db.insert(availabilityBlock).values({
      fieldId: s.fieldId,
      period: { startsAt: at(date, '09:00'), endsAt: at(date, '10:00') },
      reason: 'Manutenção da rede',
    });
    await book(
      s,
      s.fieldId,
      at(date, '10:00'),
      at(date, '11:00'),
      'confirmed',
      null,
    );
    await book(
      s,
      s.fieldId,
      at(date, '11:00'),
      at(date, '12:00'),
      'held',
      new Date(Date.now() - 60_000),
    );
    await book(
      s,
      s.otherFieldId,
      at(date, '08:00'),
      at(date, '09:00'),
      'cancelled',
      null,
    );

    const res = await get(`/api/venues/${s.slug}/availability?date=${date}`);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = ok(res);
    expect(body.date).toBe(date);
    expect(body.timezone).toBe(SP);
    expect(body.fields.map((f) => f.name)).toEqual(['Quadra A', 'Quadra B']);

    const a = body.fields.find((f) => f.id === s.fieldId);
    expect(a).toMatchObject({ name: 'Quadra A', minSlotMinutes: 60 });
    // Times below are UTC (local + 3h).
    expect(
      a?.slots.map((slot) => [hhmmZ(slot), slot.available, slot.priceCents]),
    ).toEqual([
      ['11:00', false, 8000],
      ['11:30', false, 8000],
      ['12:00', false, 8000],
      ['12:30', false, 10000],
      ['13:00', false, 12000],
      ['13:30', false, 12000],
      // 11:00 local: the expired hold frees it.
      ['14:00', true, 12000],
      // 11:30 local: a 60 min block would end after closing.
      ['14:30', false, 10000],
    ]);
    const first = a?.slots[0];
    expect(first?.startsAt).toBe(at(date, '08:00').toISOString());
    expect(first?.endsAt).toBe(at(date, '09:00').toISOString());

    const b = body.fields.find((f) => f.id === s.otherFieldId);
    expect(b?.slots.map((slot) => slot.available)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('não expõe identidade, status nem motivo de bloqueio', async () => {
    const s = await seed();
    const date = dateIn(SP, 2);
    await book(
      s,
      s.fieldId,
      at(date, '08:00'),
      at(date, '09:00'),
      'confirmed',
      null,
    );
    await handle.db.insert(availabilityBlock).values({
      fieldId: s.fieldId,
      period: { startsAt: at(date, '10:00'), endsAt: at(date, '11:00') },
      reason: 'Motivo Reservado',
    });
    const res = await get(`/api/venues/${s.slug}/availability?date=${date}`);
    expect(res.statusCode).toBe(200);
    for (const secret of [
      'bookingId',
      'userId',
      'reason',
      'status',
      'customer',
      'Cliente Secreto',
      'Motivo Reservado',
      '90000',
      ownerId,
      s.venueId,
      'Sigilosa',
      '43210',
      'phone',
    ]) {
      expect(res.body).not.toContain(secret);
    }
    const parsed = res.json<{ fields: Record<string, unknown>[] }>();
    for (const item of parsed.fields) {
      expect(Object.keys(item).sort()).toEqual([
        'id',
        'minSlotMinutes',
        'name',
        'slots',
      ]);
    }
  });

  it('usa o fuso do espaço', async () => {
    const s = await seed({ timezone: 'America/Manaus' });
    const date = dateIn('America/Manaus', 1);
    const body = ok(
      await get(`/api/venues/${s.slug}/availability?date=${date}`),
    );
    expect(body.timezone).toBe('America/Manaus');
    // 08:00 in Manaus (UTC-4) is 12:00Z.
    expect(body.fields[0]?.slots[0]?.startsAt).toBe(`${date}T12:00:00.000Z`);
  });

  it('hoje: horários que já passaram não estão disponíveis', async () => {
    const s = await seed({ allDay: true });
    const date = dateIn(SP, 0);
    const body = ok(
      await get(`/api/venues/${s.slug}/availability?date=${date}`),
    );
    const now = Date.now();
    const slots = body.fields[0]?.slots ?? [];
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      if (new Date(slot.startsAt).getTime() < now) {
        expect(slot.available).toBe(false);
      }
    }
  });

  it('um dia sem funcionamento devolve as quadras sem horários', async () => {
    const s = await seed();
    await handle.db.delete(venueHours).where(eq(venueHours.venueId, s.venueId));
    const body = ok(
      await get(`/api/venues/${s.slug}/availability?date=${dateIn(SP, 2)}`),
    );
    expect(body.fields.map((f) => f.slots)).toEqual([[], []]);
  });

  it('aceita hoje e hoje + 60 dias; recusa fora disso com 422 pt-BR', async () => {
    const s = await seed();
    const path = `/api/venues/${s.slug}/availability`;
    expect((await get(`${path}?date=${dateIn(SP, 0)}`)).statusCode).toBe(200);
    expect((await get(`${path}?date=${dateIn(SP, 60)}`)).statusCode).toBe(200);
    for (const date of [dateIn(SP, -1), dateIn(SP, 61), '2020-01-01']) {
      const res = await get(`${path}?date=${date}`);
      expect(res.statusCode).toBe(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const problem = res.json<Problem>();
      expect(problem.status).toBe(422);
      expect(problem.errors?.['date']?.[0]).toMatch(/data/i);
    }
  });

  it.each(['', '?date=', '?date=2026-02-30', '?date=amanha', '?date=2026-1-1'])(
    'data ausente ou inválida (%j) → 422',
    async (qs) => {
      const s = await seed();
      const res = await get(`/api/venues/${s.slug}/availability${qs}`);
      expect(res.statusCode).toBe(422);
      expect(res.json<Problem>().title).toBe('Dados inválidos');
    },
  );

  it('rascunho e espaço inexistente → 404', async () => {
    const draft = await seed({ status: 'draft' });
    const date = dateIn(SP, 1);
    for (const slug of [draft.slug, `nao-existe-${uniqueToken()}`, 'A_B']) {
      const res = await get(`/api/venues/${slug}/availability?date=${date}`);
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json<Problem>().detail).toBe('Espaço não encontrado');
    }
  });

  it('não lista quadras inativas', async () => {
    const s = await seed();
    const body = ok(
      await get(`/api/venues/${s.slug}/availability?date=${dateIn(SP, 1)}`),
    );
    expect(body.fields.map((f) => f.id)).not.toContain(s.inactiveFieldId);
    expect(body.fields[0]?.slots).toHaveLength(8);
  });
});
