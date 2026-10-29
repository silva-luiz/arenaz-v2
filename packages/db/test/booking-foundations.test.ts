import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));

let pool: pg.Pool;

beforeAll(() => {
  pool = new pg.Pool({ connectionString: inject('DATABASE_URL') });
});

afterAll(async () => {
  await pool.end();
});

// ------------------------------------------------------------- fixtures ----

interface SeedVenue {
  state?: string;
  /** `null` leaves the column out (the legacy schema has none). */
  timezone?: string | null;
}

async function seedVenue(
  db: pg.Pool,
  { state = 'SP', timezone = 'America/Sao_Paulo' }: SeedVenue = {},
): Promise<string> {
  const ownerId = `owner-${randomUUID()}`;
  await db.query('insert into "user" (id, name, email) values ($1, $2, $3)', [
    ownerId,
    'Dono',
    `${ownerId}@mail.com`,
  ]);
  const params: string[] = [ownerId, `slug-${randomUUID()}`, state];
  if (timezone !== null) params.push(timezone);
  const { rows } = await db.query<{ id: string }>(
    `insert into venue (owner_id, slug, name, phone, cep, street, number,
       neighborhood, city, state, location, cancellation_policy
       ${timezone === null ? '' : ', timezone'})
     values ($1, $2, 'Arena', '+5511987654321', '01310100', 'Rua A', '1',
       'Centro', 'Cidade', $3, ST_SetSRID(ST_MakePoint(-46.6, -23.5), 4326)::geography,
       'flexivel' ${timezone === null ? '' : ', $4'})
     returning id`,
    params,
  );
  return rows[0]?.id ?? '';
}

async function seedField(db: pg.Pool, venueId: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into field (venue_id, name, sports, surface, min_slot_minutes, base_price_cents_per_hour)
     values ($1, 'Quadra', '{futsal}', 'piso_rigido', 60, 10000) returning id`,
    [venueId],
  );
  return rows[0]?.id ?? '';
}

interface Rule {
  weekdays?: string;
  start?: number;
  end?: number;
  price?: number;
}

const insertRule = (db: pg.Pool, fieldId: string, rule: Rule) =>
  db.query(
    `insert into price_rule (field_id, weekdays, start_minute, end_minute, price_cents_per_hour)
     values ($1, $2::smallint[], $3, $4, $5)`,
    [
      fieldId,
      rule.weekdays ?? '{1}',
      rule.start ?? 600,
      rule.end ?? 720,
      rule.price ?? 10000,
    ],
  );

const insertBlock = (db: pg.Pool, fieldId: string, range: string) =>
  db.query(
    'insert into availability_block (field_id, period) values ($1, $2::tstzrange)',
    [fieldId, range],
  );

// ---------------------------------------------------------------- tests ----

describe('venue.timezone', () => {
  it('é obrigatório e só aceita a lista de fusos brasileiros', async () => {
    await expect(seedVenue(pool, { timezone: null })).rejects.toMatchObject({
      code: '23502',
    });
    await expect(
      seedVenue(pool, { timezone: 'Europe/Lisbon' }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      seedVenue(pool, { timezone: 'America/Manaus' }),
    ).resolves.toBeTruthy();
  });

  it('todo fuso listado no CHECK é inserível (16 fusos)', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
        where conname = 'venue_timezone_check'`,
    );
    const listed = [...(rows[0]?.def ?? '').matchAll(/'([A-Za-z_/]+)'/g)].map(
      (match) => match[1] ?? '',
    );
    expect(listed).toHaveLength(16);
    for (const timezone of listed) {
      await expect(seedVenue(pool, { timezone })).resolves.toBeTruthy();
    }
  });
});

describe('venue_hours v2', () => {
  it('aceita vários intervalos no mesmo dia e mantém os CHECKs', async () => {
    const venueId = await seedVenue(pool);
    const insert = (weekday: number, open: number, close: number) =>
      pool.query(
        'insert into venue_hours (venue_id, weekday, open_minute, close_minute) values ($1, $2, $3, $4)',
        [venueId, weekday, open, close],
      );
    await insert(5, 480, 720);
    await insert(5, 1020, 1440);
    await expect(insert(5, 600, 600)).rejects.toMatchObject({ code: '23514' });
    await expect(insert(5, 485, 600)).rejects.toMatchObject({ code: '23514' });
    await expect(insert(5, 600, 1470)).rejects.toMatchObject({ code: '23514' });

    const { rows } = await pool.query<{ id: string }>(
      'select id from venue_hours where venue_id = $1',
      [venueId],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).not.toBe(rows[1]?.id);
  });

  it('indexa (venue_id, weekday)', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where tablename = 'venue_hours'",
    );
    expect(rows.map((row) => row.indexdef).join('\n')).toMatch(
      /\(venue_id, weekday\)/,
    );
  });
});

describe('price_rule CHECKs', () => {
  it('rejeitam minuto fora do passo, weekdays vazio/inválido e preço absurdo', async () => {
    const fieldId = await seedField(pool, await seedVenue(pool));
    await insertRule(pool, fieldId, {});
    await insertRule(pool, fieldId, { start: 0, end: 1440, price: 1_000_000 });

    const bad: Rule[] = [
      { start: 615 },
      { end: 725 },
      { start: -30 },
      { end: 1470 },
      { weekdays: '{}' },
      { weekdays: '{9}' },
      { weekdays: '{1,7}' },
      { weekdays: '{-1}' },
      { price: 1_000_001 },
    ];
    for (const patch of bad) {
      await expect(insertRule(pool, fieldId, patch)).rejects.toMatchObject({
        code: '23514',
      });
    }
  });
});

describe('availability_block', () => {
  it('só aceita períodos [) finitos', async () => {
    const fieldId = await seedField(pool, await seedVenue(pool));
    await insertBlock(
      pool,
      fieldId,
      '[2031-01-01 10:00+00,2031-01-01 12:00+00)',
    );
    for (const range of [
      '(2031-02-01 10:00+00,2031-02-01 12:00+00)',
      '[2031-02-01 10:00+00,2031-02-01 12:00+00]',
      '(2031-02-01 10:00+00,2031-02-01 12:00+00]',
      '[2031-02-01 10:00+00,)',
      '(,2031-02-01 12:00+00)',
    ]) {
      await expect(insertBlock(pool, fieldId, range)).rejects.toMatchObject({
        code: '23514',
      });
    }
  });

  it('dois bloqueios sobrepostos na mesma quadra violam o EXCLUDE (23P01)', async () => {
    const venueId = await seedVenue(pool);
    const fieldId = await seedField(pool, venueId);
    const otherField = await seedField(pool, venueId);
    await insertBlock(
      pool,
      fieldId,
      '[2031-03-01 10:00+00,2031-03-01 12:00+00)',
    );
    await expect(
      insertBlock(pool, fieldId, '[2031-03-01 11:00+00,2031-03-01 13:00+00)'),
    ).rejects.toMatchObject({ code: '23P01' });
    // Touching ranges, and the same period on another court, are fine.
    await insertBlock(
      pool,
      fieldId,
      '[2031-03-01 12:00+00,2031-03-01 13:00+00)',
    );
    await insertBlock(
      pool,
      otherField,
      '[2031-03-01 10:00+00,2031-03-01 12:00+00)',
    );
  });
});

describe('migração 0006 sobre dados legados', () => {
  /** Applies 0000-0005, lets `seed` insert legacy rows, then applies 0006. */
  async function migrateLegacy(
    seed: (db: pg.Pool) => Promise<void>,
  ): Promise<pg.Pool> {
    const dir = mkdtempSync(join(tmpdir(), 'arenaz-legacy-'));
    cpSync(MIGRATIONS, dir, { recursive: true });
    const journalPath = join(dir, 'meta', '_journal.json');
    const fullJournal = readFileSync(journalPath, 'utf8');
    const journal = JSON.parse(fullJournal) as { entries: unknown[] };
    writeFileSync(
      journalPath,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, 6) }),
    );

    const name = `legacy_${randomUUID().replaceAll('-', '')}`;
    await pool.query(`create database ${name}`);
    const url = new URL(inject('DATABASE_URL'));
    url.pathname = `/${name}`;
    const legacy = new pg.Pool({ connectionString: url.toString() });
    await migrate(drizzle(legacy), { migrationsFolder: dir });
    await seed(legacy);
    writeFileSync(journalPath, fullJournal);
    await migrate(drizzle(legacy), { migrationsFolder: dir });
    return legacy;
  }

  it('preenche o fuso pela UF, converte as horas e limpa o legado inválido', async () => {
    const legacy = await migrateLegacy(async (db) => {
      for (const state of ['AM', 'AC', 'BA', 'PE', 'SP', 'PA', 'CE', 'MT']) {
        await seedVenue(db, { state, timezone: null });
      }
      const venueId = await seedVenue(db, { timezone: null });
      const fieldId = await seedField(db, venueId);
      await db.query(
        'insert into venue_hours (venue_id, weekday, open_minute, close_minute) values ($1, 1, 480, 1320)',
        [venueId],
      );
      // Rows the new CHECKs would refuse.
      await db.query(
        `insert into price_rule (field_id, weekdays, start_minute, end_minute, price_cents_per_hour) values
           ($1, '{1,2}', 600, 720, 10000),
           ($1, '{1}', 610, 720, 11000),
           ($1, '{0,9,3}', 600, 720, 12000),
           ($1, '{9}', 600, 720, 13000),
           ($1, '{}', 600, 720, 14000),
           ($1, '{2}', 600, 720, 5000000)`,
        [fieldId],
      );
      await db.query(
        `insert into availability_block (field_id, period, created_at) values
           ($1, '[2031-05-01 10:00+00,2031-05-01 12:00+00)', now() - interval '3 hours'),
           ($1, '[2031-05-01 11:00+00,2031-05-01 13:00+00)', now() - interval '2 hours'),
           ($1, '[2031-05-01 12:30+00,2031-05-01 14:00+00)', now() - interval '1 hours'),
           ($1, '(2031-06-01 10:00+00,2031-06-01 12:00+00]', now()),
           ($1, '[2031-07-01 10:00+00,)', now())`,
        [fieldId],
      );
    });
    try {
      const zones = await legacy.query<{ state: string; timezone: string }>(
        'select distinct state, timezone from venue',
      );
      expect(
        Object.fromEntries(zones.rows.map((r) => [r.state, r.timezone])),
      ).toEqual({
        AM: 'America/Manaus',
        AC: 'America/Rio_Branco',
        BA: 'America/Bahia',
        PE: 'America/Recife',
        SP: 'America/Sao_Paulo',
        PA: 'America/Belem',
        CE: 'America/Fortaleza',
        MT: 'America/Cuiaba',
      });

      const hours = await legacy.query<{ id: string; weekday: number }>(
        'select id, weekday from venue_hours',
      );
      expect(hours.rows).toHaveLength(1);
      expect(hours.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);

      const rules = await legacy.query<{
        weekdays: number[];
        price_cents_per_hour: number;
      }>(
        'select weekdays, price_cents_per_hour from price_rule order by price_cents_per_hour',
      );
      expect(rules.rows).toEqual([
        { weekdays: [1, 2], price_cents_per_hour: 10000 },
        { weekdays: [0, 3], price_cents_per_hour: 12000 },
      ]);

      const blocks = await legacy.query<{ period: string }>(
        'select period::text from availability_block order by lower(period)',
      );
      expect(blocks.rows.map((block) => block.period)).toEqual([
        '["2031-05-01 10:00:00+00","2031-05-01 12:00:00+00")',
        '["2031-05-01 12:30:00+00","2031-05-01 14:00:00+00")',
        '["2031-06-01 10:00:00+00","2031-06-01 12:00:00+00")',
      ]);
    } finally {
      await legacy.end();
    }
  });
});
