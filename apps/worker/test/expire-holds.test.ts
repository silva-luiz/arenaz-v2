import { schema } from '@arenaz/db';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { expireHolds } from '../src/expire-holds.js';
import { insertBooking, openDb, seedField } from './seed.js';

const { booking } = schema;
const handle = openDb();
afterAll(async () => {
  await handle.pool.end();
});

const MIN = 60_000;

async function rowOf(id: string) {
  const [row] = await handle.db
    .select({
      status: booking.status,
      cancelledBy: booking.cancelledBy,
    })
    .from(booking)
    .where(eq(booking.id, id));
  if (!row) throw new Error('reserva sumiu');
  return row;
}

describe('expireHolds', () => {
  it('expires only overdue holds and leaves live holds and confirmed alone', async () => {
    const s = await seedField(handle);
    const overdue = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() - MIN),
    );
    const live = await insertBooking(
      handle,
      s,
      1,
      'held',
      new Date(Date.now() + 5 * MIN),
    );
    const confirmed = await insertBooking(handle, s, 2, 'confirmed', null);

    const count = await expireHolds(handle.db);

    expect(count).toBeGreaterThanOrEqual(1);
    expect(await rowOf(overdue)).toMatchObject({
      status: 'expired',
      cancelledBy: 'system',
    });
    expect(await rowOf(live)).toMatchObject({
      status: 'held',
      cancelledBy: null,
    });
    expect(await rowOf(confirmed)).toMatchObject({
      status: 'confirmed',
      cancelledBy: null,
    });
  });

  it('uses the same boundary as the API: a hold due exactly now is expired', async () => {
    const s = await seedField(handle);
    const at = new Date(Date.now() + 10 * MIN);
    const due = await insertBooking(handle, s, 0, 'held', at);
    const later = await insertBooking(
      handle,
      s,
      1,
      'held',
      new Date(at.getTime() + 1),
    );

    await expireHolds(handle.db, at);

    expect((await rowOf(due)).status).toBe('expired');
    expect((await rowOf(later)).status).toBe('held');
  });

  it('frees the slot for a new hold and is idempotent', async () => {
    const s = await seedField(handle);
    const id = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() - MIN),
    );
    await expireHolds(handle.db);
    const again = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() + 5 * MIN),
    );
    expect((await rowOf(id)).status).toBe('expired');
    expect((await rowOf(again)).status).toBe('held');

    await expireHolds(handle.db);
    expect((await rowOf(again)).status).toBe('held');
  });

  it('processes more than one batch of 500', async () => {
    const s = await seedField(handle);
    const past = new Date(Date.now() - MIN);
    const ids: string[] = [];
    for (let i = 0; i < 520; i += 20) {
      const chunk = await Promise.all(
        Array.from({ length: Math.min(20, 520 - i) }, (_, k) =>
          insertBooking(handle, s, i + k, 'held', past),
        ),
      );
      ids.push(...chunk);
    }

    const count = await expireHolds(handle.db);

    expect(count).toBeGreaterThanOrEqual(520);
    const rows = await handle.db
      .select({ status: booking.status })
      .from(booking)
      .where(inArray(booking.id, ids));
    expect(rows).toHaveLength(520);
    expect(rows.every((r) => r.status === 'expired')).toBe(true);
  });

  it('skips a hold whose row is locked by a payment instead of racing it', async () => {
    const s = await seedField(handle);
    const id = await insertBooking(
      handle,
      s,
      0,
      'held',
      new Date(Date.now() - MIN),
    );

    const client = await handle.pool.connect();
    try {
      await client.query('begin');
      await client.query('select 1 from booking where id = $1 for update', [
        id,
      ]);
      // The payment holds the row: the worker must neither wait nor touch it.
      await expireHolds(handle.db);
      expect((await rowOf(id)).status).toBe('held');
      await client.query(
        "update booking set status = 'confirmed', confirmed_at = now(), hold_expires_at = null where id = $1",
        [id],
      );
      await client.query('commit');
    } finally {
      client.release();
    }

    await expireHolds(handle.db);
    expect((await rowOf(id)).status).toBe('confirmed');
  });
});
