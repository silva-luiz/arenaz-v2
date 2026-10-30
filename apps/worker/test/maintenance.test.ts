import { randomUUID } from 'node:crypto';
import { schema } from '@arenaz/db';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startMaintenance } from '../src/maintenance.js';
import { S3PhotoStorage } from '../src/storage.js';
import { insertBooking, openDb, seedField } from './seed.js';

const { booking, venuePhoto } = schema;
const storage = new S3PhotoStorage({
  S3_ENDPOINT: inject('S3_ENDPOINT'),
  S3_REGION: 'us-east-1',
  S3_BUCKET: inject('S3_BUCKET'),
  S3_ACCESS_KEY_ID: inject('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: inject('S3_SECRET_ACCESS_KEY'),
  S3_FORCE_PATH_STYLE: true,
});
const handle = openDb();
const logger = pino({ level: 'silent' });
let redis: StartedRedisContainer;

beforeAll(async () => {
  redis = await new RedisContainer('redis:7-alpine').start();
});

afterAll(async () => {
  storage.destroy();
  await handle.pool.end();
  await redis.stop();
});

async function statusOf(id: string): Promise<string | undefined> {
  const [row] = await handle.db
    .select({ status: booking.status })
    .from(booking)
    .where(eq(booking.id, id));
  return row?.status;
}

async function variantWidthsOf(id: string): Promise<number[] | null> {
  const [row] = await handle.db
    .select({ widths: venuePhoto.variantWidths })
    .from(venuePhoto)
    .where(eq(venuePhoto.id, id));
  return row?.widths ?? null;
}

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timeout esperando condição');
}

describe('maintenance worker', () => {
  it('runs the repeatable jobs (holds, photo variants) and does not duplicate the schedules on restart', async () => {
    const queueName = `maintenance-${String(Date.now())}`;
    const s = await seedField(handle);
    const id = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() - 60_000),
    );
    const key = `venues/${s.venueId}/${randomUUID()}.jpg`;
    await storage.put(
      key,
      await sharp({
        create: { width: 600, height: 400, channels: 3, background: '#fff' },
      })
        .jpeg()
        .toBuffer(),
      'image/jpeg',
      'no-cache',
    );
    const [photo] = await handle.db
      .insert(venuePhoto)
      .values({ venueId: s.venueId, storageKey: key, position: 0 })
      .returning({ id: venuePhoto.id });
    if (!photo) throw new Error('seed de foto falhou');
    const opts = {
      db: handle.db,
      redisUrl: redis.getConnectionUrl(),
      logger,
      storage,
      queueName,
      everyMs: 100,
      photoVariantsEveryMs: 100,
    };

    const first = await startMaintenance(opts);
    await waitFor(async () => (await statusOf(id)) === 'expired');
    await waitFor(async () => (await variantWidthsOf(photo.id)) !== null);
    expect(await variantWidthsOf(photo.id)).toEqual([400]);
    await first.close();

    // A restart upserts the same scheduler instead of adding another.
    const second = await startMaintenance(opts);
    const third = await startMaintenance(opts);
    const queue = new Queue(queueName, {
      connection: { host: redis.getHost(), port: redis.getPort() },
    });
    try {
      const schedulers = await queue.getJobSchedulers();
      expect(schedulers).toHaveLength(2);
      expect(
        [...schedulers].sort((a, b) => a.key.localeCompare(b.key)),
      ).toMatchObject([
        { key: 'expire-holds', name: 'expire-holds', every: 100 },
        { key: 'photo-variants', name: 'photo-variants', every: 100 },
      ]);

      // And it keeps working after the restart.
      const s2 = await seedField(handle);
      const id2 = await insertBooking(
        handle,
        s2,
        0,
        'held',
        new Date(Date.now() - 60_000),
      );
      await waitFor(async () => (await statusOf(id2)) === 'expired');
    } finally {
      await queue.close();
      await second.close();
      await third.close();
    }
  });
});
