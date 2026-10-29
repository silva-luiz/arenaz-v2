import { schema } from '@arenaz/db';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMaintenance } from '../src/maintenance.js';
import { insertBooking, openDb, seedField } from './seed.js';

const { booking } = schema;
const handle = openDb();
const logger = pino({ level: 'silent' });
let redis: StartedRedisContainer;

beforeAll(async () => {
  redis = await new RedisContainer('redis:7-alpine').start();
});

afterAll(async () => {
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

async function waitFor(check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timeout esperando condição');
}

describe('maintenance worker', () => {
  it('runs the repeatable job, expires overdue holds, and does not duplicate the schedule on restart', async () => {
    const queueName = `maintenance-${String(Date.now())}`;
    const s = await seedField(handle);
    const id = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() - 60_000),
    );
    const opts = {
      db: handle.db,
      redisUrl: redis.getConnectionUrl(),
      logger,
      queueName,
      everyMs: 100,
    };

    const first = await startMaintenance(opts);
    await waitFor(async () => (await statusOf(id)) === 'expired');
    await first.close();

    // A restart upserts the same scheduler instead of adding another.
    const second = await startMaintenance(opts);
    const third = await startMaintenance(opts);
    const queue = new Queue(queueName, {
      connection: { host: redis.getHost(), port: redis.getPort() },
    });
    try {
      const schedulers = await queue.getJobSchedulers();
      expect(schedulers).toHaveLength(1);
      expect(schedulers[0]).toMatchObject({
        key: 'expire-holds',
        name: 'expire-holds',
        every: 100,
      });

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
