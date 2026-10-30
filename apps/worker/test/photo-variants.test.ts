import { randomUUID } from 'node:crypto';
import { photoVariantKey } from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { MAX_ATTEMPTS, makePhotoVariants } from '../src/photo-variants.js';
import { S3PhotoStorage } from '../src/storage.js';
import { openDb, seedField } from './seed.js';

const { venuePhoto } = schema;
const handle = openDb();
const logger = pino({ level: 'silent' });
const config = {
  S3_ENDPOINT: inject('S3_ENDPOINT'),
  S3_REGION: 'us-east-1',
  S3_BUCKET: inject('S3_BUCKET'),
  S3_ACCESS_KEY_ID: inject('S3_ACCESS_KEY_ID'),
  S3_SECRET_ACCESS_KEY: inject('S3_SECRET_ACCESS_KEY'),
  S3_FORCE_PATH_STYLE: true,
};
const storage = new S3PhotoStorage(config);
// Reads and writes the bucket directly, as a check independent of the worker.
const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});

afterAll(async () => {
  storage.destroy();
  s3.destroy();
  await handle.pool.end();
});

// The job claims ANY pending photo, so each test starts with none (worker
// test files run one at a time, see vitest.config.ts).
beforeEach(async () => {
  await handle.db.delete(venuePhoto);
});

async function jpeg(
  width: number,
  height: number,
  orientation?: number,
): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: '#1f8a3c' },
  }).jpeg();
  return (
    orientation === undefined ? image : image.withMetadata({ orientation })
  ).toBuffer();
}

/** A photo row of a fresh venue, with `body` stored under its key (if any). */
async function addPhoto(
  body: Buffer | null,
  overrides: { variantAttempts?: number } = {},
): Promise<{ id: string; key: string }> {
  const { venueId } = await seedField(handle);
  const key = `venues/${venueId}/${randomUUID()}.jpg`;
  if (body) {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg',
      }),
    );
  }
  const [row] = await handle.db
    .insert(venuePhoto)
    .values({ venueId, storageKey: key, position: 0, ...overrides })
    .returning({ id: venuePhoto.id });
  if (!row) throw new Error('seed de foto falhou');
  return { id: row.id, key };
}

async function rowOf(id: string) {
  const [row] = await handle.db
    .select({
      variantWidths: venuePhoto.variantWidths,
      variantAttempts: venuePhoto.variantAttempts,
    })
    .from(venuePhoto)
    .where(eq(venuePhoto.id, id));
  if (!row) throw new Error('foto sumiu');
  return row;
}

async function head(key: string) {
  try {
    return await s3.send(
      new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
    );
  } catch {
    return null;
  }
}

async function read(key: string): Promise<Uint8Array> {
  const out = await s3.send(
    new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }),
  );
  return (await out.Body?.transformToByteArray()) ?? new Uint8Array();
}

const run = () => makePhotoVariants(handle.db, storage, logger);

describe('makePhotoVariants', () => {
  it('writes WebP variants only for the widths smaller than the original', async () => {
    const photo = await addPhoto(await jpeg(1000, 600));

    expect(await run()).toEqual({ done: 1, failed: 0 });

    expect(await rowOf(photo.id)).toEqual({
      variantWidths: [400, 800],
      variantAttempts: 0,
    });
    for (const width of [400, 800]) {
      const key = photoVariantKey(photo.key, width);
      const stored = await head(key);
      expect(stored?.ContentType).toBe('image/webp');
      expect(stored?.CacheControl).toBe('public, max-age=31536000, immutable');
      const meta = await sharp(await read(key)).metadata();
      expect(meta).toMatchObject({
        format: 'webp',
        width,
        height: (width * 600) / 1000,
      });
      // Metadata is stripped.
      expect(meta.exif).toBeUndefined();
    }
    expect(await head(photoVariantKey(photo.key, 1600))).toBeNull();
    // The original is left alone.
    expect(await head(photo.key)).not.toBeNull();
  });

  it('a photo no wider than the smallest variant gets none ({})', async () => {
    const photo = await addPhoto(await jpeg(400, 300));
    expect(await run()).toEqual({ done: 1, failed: 0 });
    expect((await rowOf(photo.id)).variantWidths).toEqual([]);
    expect(await head(photoVariantKey(photo.key, 400))).toBeNull();
  });

  it('auto-orients by EXIF before measuring and resizing', async () => {
    // Stored 1000x500 but displayed rotated: 500 wide, 1000 tall.
    const photo = await addPhoto(await jpeg(1000, 500, 6));
    await run();
    expect((await rowOf(photo.id)).variantWidths).toEqual([400]);
    const meta = await sharp(
      await read(photoVariantKey(photo.key, 400)),
    ).metadata();
    expect(meta).toMatchObject({ width: 400, height: 800 });
    expect(meta.orientation).toBeUndefined();
  });

  it('a corrupt image counts an attempt per run and is skipped after 3', async () => {
    const corrupt = await addPhoto(Buffer.from('não é uma imagem'));
    const good = await addPhoto(await jpeg(900, 900));

    // The failure does not stop the batch.
    expect(await run()).toEqual({ done: 1, failed: 1 });
    expect(await rowOf(corrupt.id)).toEqual({
      variantWidths: null,
      variantAttempts: 1,
    });
    expect((await rowOf(good.id)).variantWidths).toEqual([400, 800]);

    // One attempt per run, never several in the same run.
    expect(await run()).toEqual({ done: 0, failed: 1 });
    expect((await rowOf(corrupt.id)).variantAttempts).toBe(2);
    expect(await run()).toEqual({ done: 0, failed: 1 });
    expect((await rowOf(corrupt.id)).variantAttempts).toBe(MAX_ATTEMPTS);

    expect(await run()).toEqual({ done: 0, failed: 0 });
    expect(await rowOf(corrupt.id)).toEqual({
      variantWidths: null,
      variantAttempts: MAX_ATTEMPTS,
    });
  });

  it('skips a photo that already used up its attempts, even a valid one', async () => {
    const photo = await addPhoto(await jpeg(1000, 600), {
      variantAttempts: MAX_ATTEMPTS,
    });
    expect(await run()).toEqual({ done: 0, failed: 0 });
    expect((await rowOf(photo.id)).variantWidths).toBeNull();
    expect(await head(photoVariantKey(photo.key, 400))).toBeNull();
  });

  it('a missing original is a failed attempt, not a crash', async () => {
    const photo = await addPhoto(null);
    expect(await run()).toEqual({ done: 0, failed: 1 });
    expect(await rowOf(photo.id)).toEqual({
      variantWidths: null,
      variantAttempts: 1,
    });
  });

  it('handles at most 5 photos per run, oldest first', async () => {
    const photos = [];
    for (let i = 0; i < 6; i += 1) {
      photos.push(await addPhoto(await jpeg(500, 500)));
    }
    const last = photos[5];
    if (!last) throw new Error('seed');

    expect(await run()).toEqual({ done: 5, failed: 0 });
    expect((await rowOf(last.id)).variantWidths).toBeNull();

    expect(await run()).toEqual({ done: 1, failed: 0 });
    expect((await rowOf(last.id)).variantWidths).toEqual([400]);
  });

  it('skips a photo locked by another transaction instead of waiting', async () => {
    const photo = await addPhoto(await jpeg(1000, 600));
    const client = await handle.pool.connect();
    try {
      await client.query('begin');
      await client.query('select 1 from venue_photo where id = $1 for update', [
        photo.id,
      ]);
      expect(await run()).toEqual({ done: 0, failed: 0 });
      await client.query('rollback');
    } finally {
      client.release();
    }
    expect(await run()).toEqual({ done: 1, failed: 0 });
  });

  it('a photo deleted while it is processed: the delete waits, nothing breaks', async () => {
    const photo = await addPhoto(await jpeg(1000, 600));
    const other = await addPhoto(await jpeg(1000, 600));
    // The owner deletes the photo (another connection, like the API) while
    // the job is downloading it.
    let deleted: Promise<unknown> | undefined;
    const deleting = {
      get: (key: string) => {
        if (key === photo.key) {
          deleted = handle.pool.query('delete from venue_photo where id = $1', [
            photo.id,
          ]);
        }
        return storage.get(key);
      },
      put: (key: string, body: Uint8Array, type: string, cache: string) =>
        storage.put(key, body, type, cache),
    };
    expect(await makePhotoVariants(handle.db, deleting, logger)).toEqual({
      done: 2,
      failed: 0,
    });
    // The row lock made the delete wait for the job; it then goes through
    // (and the API removes the variants with the original afterwards).
    await deleted;
    const [gone] = await handle.db
      .select()
      .from(venuePhoto)
      .where(eq(venuePhoto.id, photo.id));
    expect(gone).toBeUndefined();
    expect((await rowOf(other.id)).variantWidths).toEqual([400, 800]);
  });
});
