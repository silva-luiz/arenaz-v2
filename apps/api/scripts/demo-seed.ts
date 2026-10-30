// Demo seed: fills a separate `*_demo` database with the 13 venues and photos
// of the approved prototype. Run it with `pnpm --filter @arenaz/api demo:seed`
// (see infra/demo/README.md). Node runs this file directly (type stripping),
// so keep to erasable TypeScript and `.ts` import specifiers.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  addDays,
  localDateOf,
  priceSegments,
  toInstant,
} from '@arenaz/booking-core';
import { createDb, runMigrations, schema, type Db } from '@arenaz/db';
import { hashPassword } from 'better-auth/crypto';
import { eq, inArray } from 'drizzle-orm';
import { loadEnv } from '../src/config/env.ts';
import { photoObjectKeys } from '../src/storage/photo-objects.ts';
import { S3Storage } from '../src/storage/s3.storage.ts';
import type { StoragePort } from '../src/storage/storage.port.ts';
import {
  DEMO_CLOSE_MINUTE,
  DEMO_OPEN_MINUTE,
  DEMO_OWNER,
  DEMO_PLAYER,
  DEMO_TIMEZONE,
  DEMO_VENUES,
  type DemoBooking,
  type DemoVenue,
} from './demo-data.ts';

const {
  user,
  account,
  venue,
  venueHours,
  venuePhoto,
  field,
  priceRule,
  booking,
} = schema;

export const MIN_DEMO_PASSWORD_LENGTH = 12;
const PHOTOS_DIR = new URL('../../../infra/demo/photos/', import.meta.url);
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** The slice of the storage the seed needs. */
export type DemoStorage = Pick<StoragePort, 'put' | 'delete'>;

export interface DemoSeedOptions {
  db: Db;
  storage: DemoStorage;
  /** Password of both demo accounts (at least 12 characters). */
  password: string;
  /** "Today" and "tomorrow" of the demo bookings are read from this instant. */
  now: Date;
  /** Folder with the `<name>.jpg` photos. Defaults to infra/demo/photos. */
  photosDir?: URL;
  log?: (message: string) => void;
}

export interface DemoSeedResult {
  ownerId: string;
  playerId: string;
  venues: number;
  photos: number;
  bookings: number;
}

/**
 * Refuses to run anywhere but a database named `*_demo` outside production.
 * The seed deletes and recreates everything the demo owner has.
 */
export function assertDemoTarget(
  databaseUrl: string,
  nodeEnv: string | undefined,
): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'O seed de demonstração não roda em produção (NODE_ENV=production).',
    );
  }
  let name: string;
  try {
    name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  } catch {
    throw new Error(
      'DATABASE_URL inválida: informe uma URL do Postgres terminando em /arenaz_demo.',
    );
  }
  if (!name.endsWith('_demo')) {
    throw new Error(
      `O seed de demonstração só roda em um banco cujo nome termina em _demo (recebido: "${name}"). Use, por exemplo, DATABASE_URL=postgres://arenaz:arenaz@localhost:5433/arenaz_demo.`,
    );
  }
}

export function assertDemoPassword(password: string | undefined): string {
  if (!password || password.length < MIN_DEMO_PASSWORD_LENGTH) {
    throw new Error(
      `Defina DEMO_PASSWORD com pelo menos ${String(MIN_DEMO_PASSWORD_LENGTH)} caracteres: é a senha das contas de demonstração.`,
    );
  }
  return password;
}

/** Returns the id of the account with this e-mail, creating it once. */
async function ensureUser(
  db: Db,
  person: { email: string; name: string },
  password: string,
  now: Date,
): Promise<string> {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, person.email));
  if (existing) return existing.id;

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  });
  return id;
}

const minuteOf = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

/** A confirmed booking row, priced exactly like the API prices it. */
function bookingRow(
  demo: DemoVenue,
  ids: { venueId: string; fieldId: string },
  planned: DemoBooking,
  today: string,
  playerId: string,
  now: Date,
): typeof booking.$inferInsert {
  const date = addDays(today, planned.day);
  const startMinute = minuteOf(planned.start);
  const startsAt = toInstant(date, startMinute, DEMO_TIMEZONE);
  const endsAt = toInstant(date, startMinute + planned.minutes, DEMO_TIMEZONE);
  const rules = demo.field.peak
    ? [
        {
          id: 'peak',
          weekdays: ALL_WEEKDAYS,
          startMinute: demo.field.peak.startMinute,
          endMinute: demo.field.peak.endMinute,
          priceCentsPerHour: demo.field.peak.priceCents,
        },
      ]
    : [];
  const segments = priceSegments(
    startsAt,
    endsAt,
    DEMO_TIMEZONE,
    demo.field.basePriceCents,
    rules,
  );
  const manual = planned.customer !== undefined;
  return {
    fieldId: ids.fieldId,
    venueId: ids.venueId,
    userId: manual ? null : playerId,
    origin: manual ? 'manual' : 'app',
    status: 'confirmed',
    period: { startsAt, endsAt },
    totalCents: segments.reduce((sum, s) => sum + s.priceCents, 0),
    priceBreakdown: segments.map((s) => ({
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      priceCents: s.priceCents,
    })),
    customerName: planned.customer ?? null,
    createdAt: now,
    confirmedAt: now,
  };
}

/**
 * Deletes and recreates everything the demo owner has (bookings, then venues
 * with their hours, fields, price bands and photos) in one transaction.
 * Photos go to the storage first and the previous run's objects are removed
 * after the commit, so a failure never leaves the database pointing at
 * missing files.
 */
export async function runDemoSeed(
  options: DemoSeedOptions,
): Promise<DemoSeedResult> {
  const { db, storage, now } = options;
  const log = options.log ?? ((): void => undefined);
  const password = assertDemoPassword(options.password);
  const photosDir = options.photosDir ?? PHOTOS_DIR;

  const ownerId = await ensureUser(db, DEMO_OWNER, password, now);
  const playerId = await ensureUser(db, DEMO_PLAYER, password, now);

  const files = new Map<string, Buffer>();
  for (const name of new Set(DEMO_VENUES.flatMap((v) => v.photos))) {
    files.set(name, await readFile(new URL(`${name}.jpg`, photosDir)));
  }

  const planned = DEMO_VENUES.map((demo) => ({
    demo,
    venueId: randomUUID(),
    fieldId: randomUUID(),
    photos: demo.photos.map((name, position) => ({
      name,
      position,
      key: '',
    })),
  }));
  for (const item of planned) {
    for (const photo of item.photos) {
      photo.key = `venues/${item.venueId}/${randomUUID()}.jpg`;
    }
  }

  const uploaded: string[] = [];
  let oldKeys: string[];
  try {
    for (const item of planned) {
      for (const photo of item.photos) {
        const bytes = files.get(photo.name);
        if (!bytes) throw new Error(`Foto ${photo.name}.jpg não carregada`);
        await storage.put(photo.key, bytes, 'image/jpeg');
        uploaded.push(photo.key);
      }
      log(`Fotos enviadas: ${item.demo.name}`);
    }

    const today = localDateOf(now, DEMO_TIMEZONE);
    oldKeys = await db.transaction(async (tx) => {
      const mine = tx
        .select({ id: venue.id })
        .from(venue)
        .where(eq(venue.ownerId, ownerId));
      const previous = await tx
        .select({ key: venuePhoto.storageKey })
        .from(venuePhoto)
        .where(inArray(venuePhoto.venueId, mine));
      // Bookings restrict their venue and field, so they go first.
      await tx.delete(booking).where(inArray(booking.venueId, mine));
      await tx.delete(venue).where(eq(venue.ownerId, ownerId));

      await tx.insert(venue).values(
        planned.map(({ demo, venueId }) => ({
          id: venueId,
          ownerId,
          slug: demo.slug,
          name: demo.name,
          description: demo.description,
          phone: demo.phone,
          cep: demo.cep,
          street: demo.street,
          number: demo.number,
          neighborhood: demo.neighborhood,
          city: 'São Paulo',
          state: 'SP',
          location: { lat: demo.lat, lng: demo.lng },
          amenities: [...demo.amenities],
          cancellationPolicy: 'moderada',
          timezone: DEMO_TIMEZONE,
          status: 'published',
          createdAt: now,
          updatedAt: now,
        })),
      );
      await tx.insert(venueHours).values(
        planned.flatMap(({ venueId }) =>
          ALL_WEEKDAYS.map((weekday) => ({
            venueId,
            weekday,
            openMinute: DEMO_OPEN_MINUTE,
            closeMinute: DEMO_CLOSE_MINUTE,
          })),
        ),
      );
      await tx.insert(venuePhoto).values(
        planned.flatMap(({ venueId, photos }) =>
          photos.map(({ key, position }) => ({
            venueId,
            storageKey: key,
            position,
            createdAt: now,
          })),
        ),
      );
      await tx.insert(field).values(
        planned.map(({ demo, venueId, fieldId }) => ({
          id: fieldId,
          venueId,
          name: demo.field.name,
          sports: [...demo.field.sports],
          surface: demo.field.surface,
          format: demo.field.format,
          lengthM: demo.field.lengthM.toFixed(1),
          widthM: demo.field.widthM.toFixed(1),
          minSlotMinutes: 60,
          basePriceCentsPerHour: demo.field.basePriceCents,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await tx.insert(priceRule).values(
        planned.flatMap(({ demo, fieldId }) =>
          demo.field.peak
            ? [
                {
                  fieldId,
                  weekdays: ALL_WEEKDAYS,
                  startMinute: demo.field.peak.startMinute,
                  endMinute: demo.field.peak.endMinute,
                  priceCentsPerHour: demo.field.peak.priceCents,
                  label: 'Horário nobre',
                },
              ]
            : [],
        ),
      );
      await tx
        .insert(booking)
        .values(
          planned.flatMap(({ demo, venueId, fieldId }) =>
            demo.bookings.map((b) =>
              bookingRow(demo, { venueId, fieldId }, b, today, playerId, now),
            ),
          ),
        );
      // The worker also wrote resized variants next to each original.
      return previous.flatMap((row) => photoObjectKeys(row.key));
    });
  } catch (error) {
    // Nothing points at the new objects: drop them and let the error out.
    await storage.delete(uploaded).catch(() => undefined);
    throw error;
  }

  if (oldKeys.length > 0) {
    try {
      await storage.delete(oldKeys);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(
        `Aviso: ${String(oldKeys.length)} foto(s) da execução anterior ficaram órfãs no storage (${reason}).`,
      );
    }
  }

  return {
    ownerId,
    playerId,
    venues: planned.length,
    photos: uploaded.length,
    bookings: planned.reduce((sum, p) => sum + p.demo.bookings.length, 0),
  };
}

/** Creates the database named by `databaseUrl` if the server lacks it. */
async function ensureDatabase(databaseUrl: string): Promise<boolean> {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(
      `Nome de banco inválido: "${name}" (use letras, números e _).`,
    );
  }
  url.pathname = '/postgres';
  const admin = createDb(url.toString());
  try {
    const found = await admin.pool.query(
      'select 1 from pg_database where datname = $1',
      [name],
    );
    if (found.rowCount) return false;
    await admin.pool.query(`create database "${name}"`);
    return true;
  } finally {
    await admin.pool.end();
  }
}

async function main(): Promise<void> {
  try {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    assertDemoTarget(databaseUrl, process.env['NODE_ENV']);
    const password = assertDemoPassword(process.env['DEMO_PASSWORD']);
    const env = loadEnv(process.env);

    if (await ensureDatabase(env.DATABASE_URL)) {
      console.log('Banco de demonstração criado.');
    }
    await runMigrations(env.DATABASE_URL);

    const handle = createDb(env.DATABASE_URL);
    const storage = new S3Storage(env);
    try {
      const result = await runDemoSeed({
        db: handle.db,
        storage,
        password,
        now: new Date(),
        log: console.log,
      });
      console.log(
        `Pronto: ${String(result.venues)} espaços, ${String(result.photos)} fotos e ${String(result.bookings)} reservas.`,
      );
      console.log(
        `Contas: ${DEMO_OWNER.email} (dono) e ${DEMO_PLAYER.email} (jogador), com a senha de DEMO_PASSWORD.`,
      );
    } finally {
      storage.destroy();
      await handle.pool.end();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

// Only when run as a script (`node scripts/demo-seed.ts`), never on import.
const entry = process.argv[1];
if (entry && resolve(entry) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
