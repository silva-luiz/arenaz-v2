import { localDateOf, toInstant } from '@arenaz/booking-core';
import { createDb, schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, count, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_OWNER,
  DEMO_PLAYER,
  DEMO_TIMEZONE,
  DEMO_VENUES,
} from '../scripts/demo-data.ts';
import { assertDemoTarget, runDemoSeed } from '../scripts/demo-seed.ts';
import { S3Storage } from '../src/storage/s3.storage.ts';
import { buildTestApp, testEnv } from './helpers.js';

const { user, venue, venuePhoto, venueHours, field, priceRule, booking } =
  schema;

const PASSWORD = 'Demo#2026senha';
// Tuesday 2026-11-03, 15:00 in São Paulo: "today" is fixed whatever the clock.
const NOW = new Date('2026-11-03T15:00:00-03:00');
const TODAY = localDateOf(NOW, DEMO_TIMEZONE);

const handle = createDb(testEnv.DATABASE_URL);
const storage = new S3Storage(testEnv);
let app: NestFastifyApplication | undefined;

const { db } = handle;

async function ownerId(): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, DEMO_OWNER.email));
  if (!row) throw new Error('dono demo não encontrado');
  return row.id;
}

/** Counts of every table the seed fills, for the demo owner's data only. */
async function snapshot(): Promise<Record<string, number>> {
  const owner = await ownerId();
  const venueIds = db
    .select({ id: venue.id })
    .from(venue)
    .where(eq(venue.ownerId, owner));
  const total = async (query: Promise<{ total: number }[]>): Promise<number> =>
    (await query)[0]?.total ?? 0;
  return {
    venues: await total(
      db.select({ total: count() }).from(venue).where(eq(venue.ownerId, owner)),
    ),
    hours: await total(
      db
        .select({ total: count() })
        .from(venueHours)
        .where(inArray(venueHours.venueId, venueIds)),
    ),
    photos: await total(
      db
        .select({ total: count() })
        .from(venuePhoto)
        .where(inArray(venuePhoto.venueId, venueIds)),
    ),
    fields: await total(
      db
        .select({ total: count() })
        .from(field)
        .where(inArray(field.venueId, venueIds)),
    ),
    rules: await total(
      db
        .select({ total: count() })
        .from(priceRule)
        .innerJoin(field, eq(priceRule.fieldId, field.id))
        .where(inArray(field.venueId, venueIds)),
    ),
    bookings: await total(
      db
        .select({ total: count() })
        .from(booking)
        .where(inArray(booking.venueId, venueIds)),
    ),
    users: await total(
      db
        .select({ total: count() })
        .from(user)
        .where(inArray(user.email, [DEMO_OWNER.email, DEMO_PLAYER.email])),
    ),
  };
}

async function photoKeys(): Promise<string[]> {
  const owner = await ownerId();
  const rows = await db
    .select({ key: venuePhoto.storageKey })
    .from(venuePhoto)
    .innerJoin(venue, eq(venuePhoto.venueId, venue.id))
    .where(eq(venue.ownerId, owner));
  return rows.map((row) => row.key);
}

async function seed(): Promise<void> {
  await runDemoSeed({ db, storage, password: PASSWORD, now: NOW });
}

describe('assertDemoTarget', () => {
  const url = (name: string): string =>
    `postgres://arenaz:arenaz@localhost:5433/${name}`;

  it('accepts a database named *_demo outside production', () => {
    expect(() => {
      assertDemoTarget(url('arenaz_demo'), undefined);
    }).not.toThrow();
    expect(() => {
      assertDemoTarget(url('arenaz_demo'), 'development');
    }).not.toThrow();
  });

  it('refuses NODE_ENV=production', () => {
    expect(() => {
      assertDemoTarget(url('arenaz_demo'), 'production');
    }).toThrow(/produção/);
  });

  it('refuses a database that does not end in _demo', () => {
    expect(() => {
      assertDemoTarget(url('arenaz'), undefined);
    }).toThrow(/_demo/);
    expect(() => {
      assertDemoTarget(url('arenaz_demo_backup'), undefined);
    }).toThrow(/_demo/);
  });

  it('refuses a URL without a database name or that is not a URL', () => {
    expect(() => {
      assertDemoTarget('postgres://arenaz:arenaz@localhost:5433', undefined);
    }).toThrow(/_demo/);
    expect(() => {
      assertDemoTarget('isto não é uma url', undefined);
    }).toThrow(/DATABASE_URL/);
  });
});

describe('runDemoSeed', () => {
  let firstKeys: string[] = [];
  let afterFirst: Record<string, number> = {};
  let afterSecond: Record<string, number> = {};

  beforeAll(async () => {
    await seed();
    afterFirst = await snapshot();
    firstKeys = await photoKeys();
    await seed();
    afterSecond = await snapshot();
  });

  afterAll(async () => {
    // Only what this file created: the demo owner's data and the two users.
    const keys = await photoKeys();
    const owner = await ownerId();
    const venueIds = db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.ownerId, owner));
    await db.delete(booking).where(inArray(booking.venueId, venueIds));
    await db.delete(venue).where(eq(venue.ownerId, owner));
    await db
      .delete(user)
      .where(inArray(user.email, [DEMO_OWNER.email, DEMO_PLAYER.email]));
    await storage.delete(keys);
    await app?.close();
    storage.destroy();
    await handle.pool.end();
  });

  it('publishes the 13 venues of the prototype, all owned by the demo owner', async () => {
    const owner = await ownerId();
    const rows = await db
      .select({ slug: venue.slug, status: venue.status })
      .from(venue)
      .where(eq(venue.ownerId, owner));
    expect(rows).toHaveLength(13);
    expect(rows.every((row) => row.status === 'published')).toBe(true);
    expect(rows.map((row) => row.slug).sort()).toEqual(
      DEMO_VENUES.map((v) => v.slug).sort(),
    );
    expect(DEMO_VENUES.map((v) => v.slug)).toEqual([
      'arena-vila-madalena',
      'society-pinheiros',
      'pacaembu-futsal-club',
      'quadra-coberta-perdizes',
      'arena-lapa-7',
      'campo-ibirapuera-fc',
      'futevolei-praia-urbana',
      'padel-pinheiros',
      'beach-lapa-sunset',
      'saibro-butanta',
      'raquete-clube-sumare',
      'futsal-ball-mooca',
      'sumare-society',
    ]);
  });

  it('gives Vila Madalena 5 photos, a 7x7 Society 1 and the 19h-23h price band', async () => {
    const [vm] = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.slug, 'arena-vila-madalena'));
    expect(vm).toBeDefined();
    const venueId = vm?.id ?? '';

    const photos = await db
      .select({ key: venuePhoto.storageKey, position: venuePhoto.position })
      .from(venuePhoto)
      .where(eq(venuePhoto.venueId, venueId))
      .orderBy(venuePhoto.position);
    expect(photos).toHaveLength(5);
    expect(photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4]);
    for (const photo of photos) {
      expect(photo.key).toMatch(
        new RegExp(`^venues/${venueId}/[0-9a-f-]{36}\\.jpg$`),
      );
      const stored = await storage.head(photo.key);
      expect(stored?.contentType).toBe('image/jpeg');
      expect(stored?.size).toBeGreaterThan(10_000);
    }

    const fields = await db
      .select()
      .from(field)
      .where(eq(field.venueId, venueId));
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      name: 'Society 1',
      format: '7x7',
      sports: ['futebol_society'],
      basePriceCentsPerHour: 18000,
      isActive: true,
    });

    const rules = await db
      .select()
      .from(priceRule)
      .where(eq(priceRule.fieldId, fields[0]?.id ?? ''));
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      startMinute: 19 * 60,
      endMinute: 23 * 60,
      priceCentsPerHour: 22000,
    });
    expect([...(rules[0]?.weekdays ?? [])].sort()).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it('opens every venue 07:00-24:00 on all 7 days', async () => {
    const owner = await ownerId();
    const rows = await db
      .select({
        weekday: venueHours.weekday,
        open: venueHours.openMinute,
        close: venueHours.closeMinute,
      })
      .from(venueHours)
      .innerJoin(venue, eq(venueHours.venueId, venue.id))
      .where(eq(venue.ownerId, owner));
    expect(rows).toHaveLength(13 * 7);
    expect(rows.every((r) => r.open === 420 && r.close === 1440)).toBe(true);
  });

  it('is idempotent: a second run leaves the same rows and replaces the photos', async () => {
    expect(afterSecond).toEqual(afterFirst);
    expect(afterFirst).toMatchObject({ venues: 13, users: 2, fields: 13 });
    expect(afterFirst.photos).toBe(5 + 12);

    const secondKeys = await photoKeys();
    expect(secondKeys).toHaveLength(firstKeys.length);
    expect(secondKeys.some((key) => firstKeys.includes(key))).toBe(false);
    // The objects of the first run are gone from the bucket.
    expect(await storage.head(firstKeys[0] ?? '')).toBeNull();
  });

  it('books Vila Madalena tonight, from the app and by hand', async () => {
    const [vm] = await db
      .select({ id: venue.id })
      .from(venue)
      .where(eq(venue.slug, 'arena-vila-madalena'));
    const player = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, DEMO_PLAYER.email));
    const rows = await db
      .select({
        origin: booking.origin,
        status: booking.status,
        period: booking.period,
        userId: booking.userId,
        customerName: booking.customerName,
        totalCents: booking.totalCents,
      })
      .from(booking)
      .where(
        and(eq(booking.venueId, vm?.id ?? ''), eq(booking.status, 'confirmed')),
      );
    const from = toInstant(TODAY, 16 * 60, DEMO_TIMEZONE);
    const to = toInstant(TODAY, 23 * 60, DEMO_TIMEZONE);
    const tonight = rows.filter(
      (row) => row.period.startsAt >= from && row.period.startsAt <= to,
    );
    expect(tonight.length).toBeGreaterThanOrEqual(3);
    const app = tonight.filter((row) => row.origin === 'app');
    const manual = tonight.filter((row) => row.origin === 'manual');
    expect(app.length).toBeGreaterThanOrEqual(1);
    expect(manual.length).toBeGreaterThanOrEqual(1);
    expect(app.every((row) => row.userId === player[0]?.id)).toBe(true);
    expect(manual.every((row) => row.userId === null && row.customerName)).toBe(
      true,
    );
    // 19:00-20:00 falls in the R$ 220 band; 18:00-19:00 does not.
    const at = (hour: number) =>
      tonight.find(
        (row) =>
          row.period.startsAt.getTime() ===
          toInstant(TODAY, hour * 60, DEMO_TIMEZONE).getTime(),
      );
    expect(at(18)?.totalCents).toBe(18000);
    expect(at(19)?.totalCents).toBe(22000);
  });

  it('creates accounts that sign in with the demo password', async () => {
    app = await buildTestApp();
    for (const account of [DEMO_OWNER, DEMO_PLAYER]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/email',
        payload: { email: account.email, password: PASSWORD },
        headers: { origin: testEnv.WEB_ORIGIN },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json<{ user: { name: string } }>().user.name).toBe(
        account.name,
      );
    }
  });
});
