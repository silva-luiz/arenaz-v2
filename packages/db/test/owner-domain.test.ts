import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDb, type Db } from '../src/client.js';
import { availabilityBlock, field, priceRule } from '../src/schema/field.js';
import {
  parseEwkbPoint,
  selectLocation,
  selectPeriod,
} from '../src/schema/geography.js';
import { venue, venuePhoto } from '../src/schema/venue.js';

// The database is shared with other test files running in parallel, so every
// test owns a unique user and scopes all its queries by that owner's ids.

const venueInsert = `
  insert into venue (owner_id, slug, name, phone, cep, street, number,
    neighborhood, city, state, location, cancellation_policy)
  values ($1, $2, 'Arena Pinheiros', '11999999999', '05422000', 'Rua A', '10',
    'Pinheiros', 'São Paulo', 'SP',
    ST_SetSRID(ST_MakePoint(-46.6911, -23.5614), 4326)::geography, 'flexivel')
  returning id`;

describe('domínio do dono', () => {
  let pool: pg.Pool;
  let db: Db;
  const createdUsers: string[] = [];

  beforeAll(() => {
    ({ db, pool } = createDb(inject('DATABASE_URL')));
  });

  afterAll(async () => {
    if (createdUsers.length > 0) {
      await pool.query('delete from "user" where id = any($1)', [createdUsers]);
    }
    await pool.end();
  });

  async function createOwner(): Promise<string> {
    const id = `owner-${randomUUID()}`;
    createdUsers.push(id);
    await pool.query(
      'insert into "user" (id, name, email) values ($1, $2, $3)',
      [id, 'Dono', `${id}@mail.com`],
    );
    return id;
  }

  async function createVenue(ownerId: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(venueInsert, [
      ownerId,
      `arena-${randomUUID()}`,
    ]);
    return first(rows).id;
  }

  const insertField = (
    venueId: string,
    price: number,
    slot: number,
  ): Promise<unknown> =>
    pool.query(
      `insert into field (venue_id, name, sports, surface, min_slot_minutes,
         base_price_cents_per_hour)
       values ($1, 'Quadra 1', '{futsal}', 'piso_rigido', $2, $3)`,
      [venueId, slot, price],
    );

  async function createField(venueId: string): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `insert into field (venue_id, name, sports, surface, min_slot_minutes,
         base_price_cents_per_hour)
       values ($1, 'Quadra 1', '{futsal}', 'piso_rigido', 60, 10000)
       returning id`,
      [venueId],
    );
    return first(rows).id;
  }

  const count = async (
    table: string,
    column: string,
    id: string,
  ): Promise<string | undefined> => {
    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from ${table} where ${column} = $1`,
      [id],
    );
    return rows[0]?.n;
  };

  it('cria as tabelas do domínio', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public'",
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining([
        'venue',
        'venue_hours',
        'venue_photo',
        'field',
        'price_rule',
        'availability_block',
      ]),
    );
  });

  it('location é geography e consulta por raio funciona', async () => {
    const ownerId = await createOwner();
    await createVenue(ownerId);
    const { rows: type } = await pool.query<{ udt_name: string }>(
      `select udt_name from information_schema.columns
       where table_name='venue' and column_name='location'`,
    );
    expect(type[0]?.udt_name).toBe('geography');
    const { rows } = await pool.query(
      `select id from venue
       where owner_id = $1
         and ST_DWithin(location, ST_MakePoint(-46.69, -23.56)::geography, 2000)`,
      [ownerId],
    );
    expect(rows).toHaveLength(1);
    const { rows: far } = await pool.query(
      `select id from venue
       where owner_id = $1
         and ST_DWithin(location, ST_MakePoint(-43.17, -22.9)::geography, 2000)`,
      [ownerId],
    );
    expect(far).toHaveLength(0);
  });

  it('rejeita preço zero e slot inválido', async () => {
    const venueId = await createVenue(await createOwner());
    await expect(insertField(venueId, 0, 60)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(insertField(venueId, 10000, 45)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(insertField(venueId, 10000, 60)).resolves.toBeDefined();
  });

  it('rejeita medida da quadra zerada, aceita nula ou positiva', async () => {
    const venueId = await createVenue(await createOwner());
    const withMeasures = (length: string | null, width: string | null) =>
      pool.query(
        `insert into field (venue_id, name, sports, surface, min_slot_minutes,
           base_price_cents_per_hour, length_m, width_m)
         values ($1, 'Quadra 1', '{futsal}', 'piso_rigido', 60, 10000, $2, $3)`,
        [venueId, length, width],
      );
    await expect(withMeasures('0', '20')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(withMeasures('40', '0.04')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(withMeasures(null, null)).resolves.toBeDefined();
    await expect(withMeasures('40.5', '0.1')).resolves.toBeDefined();
    await expect(withMeasures('40', null)).resolves.toBeDefined();
  });

  it('apagar o usuário apaga venues e quadras em cascata', async () => {
    const ownerId = await createOwner();
    const venueId = await createVenue(ownerId);
    const fieldId = await createField(venueId);
    await pool.query(
      `insert into venue_hours (venue_id, weekday, open_minute, close_minute)
       values ($1, 1, 480, 1320)`,
      [venueId],
    );
    await pool.query(
      `insert into venue_photo (venue_id, storage_key, position)
       values ($1, $2, 0)`,
      [venueId, `venues/${venueId}/${randomUUID()}.jpg`],
    );
    await pool.query(
      `insert into price_rule (field_id, weekdays, start_minute, end_minute,
         price_cents_per_hour)
       values ($1, '{1,2}', 1080, 1320, 15000)`,
      [fieldId],
    );
    await pool.query(
      `insert into availability_block (field_id, period)
       values ($1, tstzrange('2026-11-01T10:00Z', '2026-11-01T12:00Z', '[)'))`,
      [fieldId],
    );

    expect(await count('venue', 'owner_id', ownerId)).toBe('1');
    expect(await count('price_rule', 'field_id', fieldId)).toBe('1');
    expect(await count('venue_photo', 'venue_id', venueId)).toBe('1');

    await pool.query('delete from "user" where id = $1', [ownerId]);

    expect(await count('venue', 'owner_id', ownerId)).toBe('0');
    expect(await count('venue_hours', 'venue_id', venueId)).toBe('0');
    expect(await count('venue_photo', 'venue_id', venueId)).toBe('0');
    expect(await count('field', 'venue_id', venueId)).toBe('0');
    expect(await count('price_rule', 'field_id', fieldId)).toBe('0');
    expect(await count('availability_block', 'field_id', fieldId)).toBe('0');
  });

  it('leituras e escritas pelo Drizzle devolvem {lat,lng} e {startsAt,endsAt}', async () => {
    const ownerId = await createOwner();
    const created = await db
      .insert(venue)
      .values({
        ownerId,
        slug: `helpers-${randomUUID()}`,
        name: 'Helpers',
        phone: '11999999999',
        cep: '05422000',
        street: 'Rua A',
        number: '10',
        neighborhood: 'Pinheiros',
        city: 'São Paulo',
        state: 'SP',
        location: { lat: -23.5614, lng: -46.6911 },
        cancellationPolicy: 'moderada',
      })
      .returning({ id: venue.id, location: selectLocation(venue.location) });
    const venueId = first(created).id;
    expect(first(created).location.lat).toBeCloseTo(-23.5614, 4);
    expect(first(created).location.lng).toBeCloseTo(-46.6911, 4);

    // Plain select: the column type parses the driver's hex EWKB.
    const plain = await db.select().from(venue).where(eq(venue.id, venueId));
    expect(first(plain).location.lat).toBeCloseTo(-23.5614, 6);
    expect(first(plain).location.lng).toBeCloseTo(-46.6911, 6);

    const f = await db
      .insert(field)
      .values({
        venueId,
        name: 'Q1',
        sports: ['futsal'],
        surface: 'piso_rigido',
        minSlotMinutes: 60,
        basePriceCentsPerHour: 8000,
      })
      .returning({ id: field.id });
    const fieldId = first(f).id;
    const starts = new Date('2026-11-01T10:00:00Z');
    const ends = new Date('2026-11-01T12:00:00Z');
    await db
      .insert(availabilityBlock)
      .values({ fieldId, period: { startsAt: starts, endsAt: ends } });

    const blocks = await db
      .select()
      .from(availabilityBlock)
      .where(eq(availabilityBlock.fieldId, fieldId));
    expect(first(blocks).period).toEqual({ startsAt: starts, endsAt: ends });

    const picked = await db
      .select({ period: selectPeriod(availabilityBlock.period) })
      .from(availabilityBlock)
      .where(eq(availabilityBlock.fieldId, fieldId));
    expect(first(picked).period).toEqual({ startsAt: starts, endsAt: ends });

    const { rows } = await pool.query<{ period: string }>(
      'select period::text as period from availability_block where field_id = $1',
      [fieldId],
    );
    expect(first(rows).period).toMatch(/^\[.*\)$/);

    await expect(
      db.insert(availabilityBlock).values({
        fieldId,
        period: { startsAt: starts, endsAt: starts },
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });

    // The remaining tables' inferred insert types compile and insert.
    await db.insert(priceRule).values({
      fieldId,
      weekdays: [1],
      startMinute: 600,
      endMinute: 720,
      priceCentsPerHour: 9000,
    });
    await db
      .insert(venuePhoto)
      .values({ venueId, storageKey: `k-${randomUUID()}`, position: 0 });
  });

  it('intervalos adjacentes [10,12) e [12,14) não se sobrepõem', async () => {
    const { rows } = await pool.query<{ adjacent: boolean; overlap: boolean }>(
      `select
         tstzrange('2026-11-01T10:00Z', '2026-11-01T12:00Z', '[)')
           && tstzrange('2026-11-01T12:00Z', '2026-11-01T14:00Z', '[)') as adjacent,
         tstzrange('2026-11-01T10:00Z', '2026-11-01T12:00Z', '[)')
           && tstzrange('2026-11-01T11:00Z', '2026-11-01T13:00Z', '[)') as overlap`,
    );
    expect(first(rows).adjacent).toBe(false);
    expect(first(rows).overlap).toBe(true);
  });

  it('parseEwkbPoint lê little e big endian, com e sem SRID', () => {
    const point = (littleEndian: boolean, withSrid: boolean): string => {
      const buf = Buffer.alloc(withSrid ? 25 : 21);
      let o = 0;
      buf.writeUInt8(littleEndian ? 1 : 0, o++);
      const type = withSrid ? 0x20000001 : 1;
      if (littleEndian) buf.writeUInt32LE(type, o);
      else buf.writeUInt32BE(type, o);
      o += 4;
      if (withSrid) {
        if (littleEndian) buf.writeUInt32LE(4326, o);
        else buf.writeUInt32BE(4326, o);
        o += 4;
      }
      if (littleEndian) {
        buf.writeDoubleLE(-46.6911, o);
        buf.writeDoubleLE(-23.5614, o + 8);
      } else {
        buf.writeDoubleBE(-46.6911, o);
        buf.writeDoubleBE(-23.5614, o + 8);
      }
      return buf.toString('hex');
    };
    for (const little of [true, false]) {
      for (const srid of [true, false]) {
        expect(parseEwkbPoint(point(little, srid))).toEqual({
          lng: -46.6911,
          lat: -23.5614,
        });
      }
    }
  });
});

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('esperava ao menos uma linha');
  return row;
}
