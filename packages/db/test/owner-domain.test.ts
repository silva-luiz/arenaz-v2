import type pg from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest';
import { createDb, type Db } from '../src/client.js';
import { availabilityBlock, field } from '../src/schema/field.js';
import {
  pointSql,
  selectLocation,
  tstzrangeSql,
} from '../src/schema/geography.js';
import { venue } from '../src/schema/venue.js';

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

  beforeAll(() => {
    ({ db, pool } = createDb(inject('DATABASE_URL')));
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Only our own user: other test files share this database in parallel.
    await pool.query('delete from "user" where id = $1', ['owner-1']);
    await pool.query(
      `insert into "user" (id, name, email) values ('owner-1', 'Dono', 'dono@mail.com')`,
    );
  });

  async function createVenue(slug = 'arena-pinheiros'): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(venueInsert, [
      'owner-1',
      slug,
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
    await createVenue();
    const { rows: type } = await pool.query<{ udt_name: string }>(
      `select udt_name from information_schema.columns
       where table_name='venue' and column_name='location'`,
    );
    expect(type[0]?.udt_name).toBe('geography');
    const { rows } = await pool.query(
      `select id from venue
       where ST_DWithin(location, ST_MakePoint(-46.69, -23.56)::geography, 2000)`,
    );
    expect(rows).toHaveLength(1);
    const { rows: far } = await pool.query(
      `select id from venue
       where ST_DWithin(location, ST_MakePoint(-43.17, -22.9)::geography, 2000)`,
    );
    expect(far).toHaveLength(0);
  });

  it('rejeita preço zero e slot inválido', async () => {
    const venueId = await createVenue();
    await expect(insertField(venueId, 0, 60)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(insertField(venueId, 10000, 45)).rejects.toMatchObject({
      code: '23514',
    });
    await expect(insertField(venueId, 10000, 60)).resolves.toBeDefined();
  });

  it('apagar o usuário apaga venues e quadras em cascata', async () => {
    const venueId = await createVenue();
    await insertField(venueId, 10000, 60);
    await pool.query(
      `insert into venue_hours (venue_id, weekday, open_minute, close_minute)
       values ($1, 1, 480, 1320)`,
      [venueId],
    );
    await pool.query(
      `insert into availability_block (field_id, period)
       select id, tstzrange('2026-11-01T10:00Z', '2026-11-01T12:00Z', '[)') from field`,
    );
    await pool.query('delete from "user" where id = $1', ['owner-1']);
    for (const table of [
      'venue',
      'venue_hours',
      'field',
      'availability_block',
    ]) {
      const { rows } = await pool.query<{ n: string }>(
        `select count(*)::text as n from ${table}`,
      );
      expect(rows[0]?.n, table).toBe('0');
    }
  });

  it('helpers gravam e leem ponto e intervalo semiaberto', async () => {
    const created = await db
      .insert(venue)
      .values({
        ownerId: 'owner-1',
        slug: 'helpers',
        name: 'Helpers',
        phone: '11999999999',
        cep: '05422000',
        street: 'Rua A',
        number: '10',
        neighborhood: 'Pinheiros',
        city: 'São Paulo',
        state: 'SP',
        location: pointSql({ lat: -23.5614, lng: -46.6911 }),
        cancellationPolicy: 'moderada',
      })
      .returning({ id: venue.id, location: selectLocation(venue.location) });
    expect(first(created).location.lat).toBeCloseTo(-23.5614, 4);
    expect(first(created).location.lng).toBeCloseTo(-46.6911, 4);

    const f = await db
      .insert(field)
      .values({
        venueId: first(created).id,
        name: 'Q1',
        sports: ['futsal'],
        surface: 'piso_rigido',
        minSlotMinutes: 60,
        basePriceCentsPerHour: 8000,
      })
      .returning({ id: field.id });
    const starts = new Date('2026-11-01T10:00:00Z');
    const ends = new Date('2026-11-01T12:00:00Z');
    await db
      .insert(availabilityBlock)
      .values({ fieldId: first(f).id, period: tstzrangeSql(starts, ends) });
    const { rows } = await pool.query<{ period: string }>(
      'select period::text as period from availability_block',
    );
    expect(rows[0]?.period).toMatch(/^\[.*\)$/);
    await expect(
      db
        .insert(availabilityBlock)
        .values({ fieldId: first(f).id, period: tstzrangeSql(starts, starts) }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });
});

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('esperava ao menos uma linha');
  return row;
}
