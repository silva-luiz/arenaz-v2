import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

let pool: pg.Pool;

beforeAll(() => {
  pool = new pg.Pool({ connectionString: inject('DATABASE_URL') });
});

afterAll(async () => {
  await pool.end();
});

async function seedField(): Promise<{ venueId: string; fieldId: string }> {
  const ownerId = `owner-${randomUUID()}`;
  await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [
    ownerId,
    'Dono',
    `${ownerId}@mail.com`,
  ]);
  const venue = await pool.query<{ id: string }>(
    `insert into venue (owner_id, slug, name, phone, cep, street, number,
       neighborhood, city, state, location, cancellation_policy, timezone)
     values ($1, $2, 'Arena', '+5511987654321', '01310100', 'Rua A', '1',
       'Centro', 'Cidade', 'SP', ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)::geography,
       'flexivel', 'America/Sao_Paulo')
     returning id`,
    [ownerId, `slug-${randomUUID()}`],
  );
  const venueId = venue.rows[0]?.id ?? '';
  const field = await pool.query<{ id: string }>(
    `insert into field (venue_id, name, sports, surface, min_slot_minutes, base_price_cents_per_hour)
     values ($1, 'Quadra', '{futsal}', 'piso_rigido', 60, 10000) returning id`,
    [venueId],
  );
  return { venueId, fieldId: field.rows[0]?.id ?? '' };
}

interface Booking {
  status?: string;
  range: string;
  /** `undefined`: 10 minutes ahead for `held`, none otherwise. */
  holdExpiresAt?: 'none';
  userId?: string | null;
  total?: number;
  cancelledBy?: string | null;
  customerName?: string | null;
  /** Overrides the venue the booking claims (default: the field's). */
  venueOverride?: string;
}

function insertBooking(
  fieldId: string,
  venueId: string,
  {
    status = 'held',
    range,
    holdExpiresAt,
    userId = null,
    total = 10000,
    cancelledBy = null,
    customerName,
    venueOverride,
  }: Booking,
) {
  const hold =
    status === 'held' && holdExpiresAt === undefined
      ? "now() + interval '10 minutes'"
      : 'null';
  return pool.query(
    `insert into booking (field_id, venue_id, user_id, origin, status, period,
       total_cents, price_breakdown, hold_expires_at, cancelled_by, customer_name)
     values ($1, $2, $3, $4, $5, $6::tstzrange, $7, '[]'::jsonb, ${hold}, $8, $9)`,
    [
      fieldId,
      venueOverride ?? venueId,
      userId,
      userId === null ? 'manual' : 'app',
      status,
      range,
      total,
      cancelledBy,
      customerName === undefined
        ? userId === null
          ? 'Cliente'
          : null
        : customerName,
    ],
  );
}

const R = (from: string, to: string) =>
  `[2030-01-01 ${from}+00,2030-01-01 ${to}+00)`;

describe('booking', () => {
  it('recusa dois held/confirmed sobrepostos na mesma quadra (23P01)', async () => {
    const { venueId, fieldId } = await seedField();
    await insertBooking(fieldId, venueId, { range: R('10:00', '11:00') });
    await expect(
      insertBooking(fieldId, venueId, { range: R('10:30', '11:30') }),
    ).rejects.toMatchObject({ code: '23P01' });
    await expect(
      insertBooking(fieldId, venueId, {
        status: 'confirmed',
        range: R('10:00', '11:00'),
      }),
    ).rejects.toMatchObject({ code: '23P01' });
  });

  it('cancelled/expired não bloqueiam o período', async () => {
    const { venueId, fieldId } = await seedField();
    await insertBooking(fieldId, venueId, {
      status: 'cancelled',
      range: R('10:00', '11:00'),
      cancelledBy: 'player',
    });
    await insertBooking(fieldId, venueId, {
      status: 'expired',
      range: R('10:00', '11:00'),
      cancelledBy: 'system',
    });
    await insertBooking(fieldId, venueId, { range: R('10:00', '11:00') });
    await insertBooking(fieldId, venueId, {
      status: 'cancelled',
      range: R('10:00', '11:00'),
    });
  });

  it('períodos encostados e quadras diferentes convivem', async () => {
    const { venueId, fieldId } = await seedField();
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      range: R('10:00', '11:00'),
    });
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      range: R('11:00', '12:00'),
    });
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      range: R('09:00', '10:00'),
    });
    const other = await pool.query<{ id: string }>(
      `insert into field (venue_id, name, sports, surface, min_slot_minutes, base_price_cents_per_hour)
       values ($1, 'Quadra 2', '{futsal}', 'piso_rigido', 60, 10000) returning id`,
      [venueId],
    );
    await insertBooking(other.rows[0]?.id ?? '', venueId, {
      status: 'confirmed',
      range: R('10:00', '11:00'),
    });
  });

  it('apagar quadra com reserva é recusado (23503)', async () => {
    const { venueId, fieldId } = await seedField();
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      range: R('10:00', '11:00'),
    });
    await expect(
      pool.query('delete from field where id = $1', [fieldId]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('held exige hold_expires_at (23514)', async () => {
    const { venueId, fieldId } = await seedField();
    await expect(
      insertBooking(fieldId, venueId, {
        status: 'held',
        holdExpiresAt: 'none',
        range: R('10:00', '11:00'),
      }),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('CHECKs: total > 0, status, origem, cancelled_by e bounds do período', async () => {
    const { venueId, fieldId } = await seedField();
    const fails = (b: Booking, constraint: string) =>
      expect(insertBooking(fieldId, venueId, b)).rejects.toMatchObject({
        code: '23514',
        constraint,
      });
    await fails(
      { status: 'confirmed', total: 0, range: R('10:00', '11:00') },
      'booking_total_check',
    );
    await fails(
      { status: 'paid', range: R('10:00', '11:00') },
      'booking_status_check',
    );
    await fails(
      {
        status: 'cancelled',
        cancelledBy: 'alien',
        range: R('10:00', '11:00'),
      },
      'booking_cancelled_by_check',
    );
    await fails(
      {
        status: 'confirmed',
        range: '(2030-01-01 10:00+00,2030-01-01 11:00+00)',
      },
      'booking_period_check',
    );
    await fails(
      { status: 'confirmed', range: '[2030-01-01 10:00+00,)' },
      'booking_period_check',
    );
    await fails(
      { status: 'confirmed', range: 'empty' },
      'booking_period_check',
    );
    await fails(
      {
        status: 'held',
        holdExpiresAt: 'none',
        range: R('10:00', '11:00'),
      },
      'booking_hold_check',
    );
    await expect(
      pool.query(
        `insert into booking (field_id, venue_id, origin, status, period, total_cents, price_breakdown)
         values ($1, $2, 'web', 'confirmed', $3::tstzrange, 100, '[]')`,
        [fieldId, venueId, R('10:00', '11:00')],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'booking_origin_check',
    });
  });

  it('reserva manual exige nome do cliente (não vazio)', async () => {
    const { venueId, fieldId } = await seedField();
    for (const customerName of [null, '', '   ']) {
      await expect(
        insertBooking(fieldId, venueId, {
          status: 'confirmed',
          customerName,
          range: R('10:00', '11:00'),
        }),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'booking_manual_customer_check',
      });
    }
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      customerName: 'Maria',
      range: R('10:00', '11:00'),
    });
  });

  it('venue_id precisa ser o espaço da quadra (23503)', async () => {
    const a = await seedField();
    const b = await seedField();
    await expect(
      insertBooking(a.fieldId, a.venueId, {
        status: 'confirmed',
        venueOverride: b.venueId,
        range: R('10:00', '11:00'),
      }),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('held que vira expired libera o horário para novo held', async () => {
    const { venueId, fieldId } = await seedField();
    await insertBooking(fieldId, venueId, { range: R('10:00', '11:00') });
    await expect(
      insertBooking(fieldId, venueId, { range: R('10:00', '11:00') }),
    ).rejects.toMatchObject({ code: '23P01' });
    await pool.query(
      `update booking set status = 'expired', cancelled_by = 'system'
        where field_id = $1`,
      [fieldId],
    );
    await insertBooking(fieldId, venueId, { range: R('10:00', '11:00') });
  });

  it('apagar o usuário zera user_id (SET NULL); apagar o espaço é recusado', async () => {
    const { venueId, fieldId } = await seedField();
    const userId = `player-${randomUUID()}`;
    await pool.query(
      'insert into "user" (id, name, email) values ($1, $2, $3)',
      [userId, 'Jogador', `${userId}@mail.com`],
    );
    await insertBooking(fieldId, venueId, {
      status: 'confirmed',
      userId,
      range: R('10:00', '11:00'),
    });
    await pool.query('delete from "user" where id = $1', [userId]);
    const { rows } = await pool.query<{ user_id: string | null }>(
      'select user_id from booking where field_id = $1',
      [fieldId],
    );
    expect(rows).toEqual([{ user_id: null }]);
    await expect(
      pool.query('delete from venue where id = $1', [venueId]),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('tem os índices previstos', async () => {
    const { rows } = await pool.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'booking'`,
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'booking_venue_period_idx',
        'booking_user_created_idx',
        'booking_hold_expires_idx',
      ]),
    );
    const def = await pool.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where indexname = 'booking_user_created_idx'`,
    );
    expect(def.rows[0]?.indexdef).toMatch(/created_at DESC\)$/);
  });
});
