import { PHOTO_VARIANT_WIDTHS, photoVariantKey } from '@arenaz/contracts';
import { schema, type Db } from '@arenaz/db';
import { and, asc, eq, isNull, lt, notInArray, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import sharp from 'sharp';
import type { PhotoStorage } from './storage.js';

const { venuePhoto } = schema;

/** Photos handled per run (the job runs every 10 s). */
export const BATCH_SIZE = 5;
/** Failed runs after which a photo is left alone (its original is served). */
export const MAX_ATTEMPTS = 3;
/**
 * Decoding guard: the client re-encodes to at most 2560 px, so 40 MP is far
 * above any real upload and rejects decompression bombs.
 */
const MAX_INPUT_PIXELS = 40_000_000;
const WEBP_QUALITY = 78;
/** Variant keys are never rewritten with other bytes: cache them for good. */
const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface PhotoVariantsResult {
  done: number;
  failed: number;
}

/**
 * Resizes `original` (auto-oriented by EXIF; sharp drops all metadata on
 * output) to every variant width smaller than its own width, as WebP.
 */
export async function renderVariants(
  original: Uint8Array,
): Promise<{ width: number; body: Buffer }[]> {
  const image = sharp(original, {
    limitInputPixels: MAX_INPUT_PIXELS,
  }).rotate();
  const { autoOrient } = await image.metadata();
  const widths = PHOTO_VARIANT_WIDTHS.filter(
    (width) => width < autoOrient.width,
  );
  return Promise.all(
    widths.map(async (width) => ({
      width,
      body: await image
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer(),
    })),
  );
}

/** `Error.name: message`, never the whole error object (no request data). */
function reasonOf(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * Makes the resized variants of up to `BATCH_SIZE` pending photos
 * (`variant_widths` NULL, fewer than `MAX_ATTEMPTS` failures), oldest first.
 *
 * Each photo is claimed in its own transaction with `FOR UPDATE SKIP LOCKED`
 * and the row lock is held while it is processed: another worker never takes
 * the same photo, and an owner deleting or reordering photos waits for at
 * most one photo (deleting a row this job holds just waits; the API then
 * removes the variant objects along with the original).
 *
 * A failure (missing or corrupt original, storage error) adds one attempt and
 * the run goes on with the next photo; a photo is tried at most once per run.
 */
export async function makePhotoVariants(
  db: Db,
  storage: PhotoStorage,
  logger: Logger,
): Promise<PhotoVariantsResult> {
  const result: PhotoVariantsResult = { done: 0, failed: 0 };
  const seen: string[] = [];
  for (let index = 0; index < BATCH_SIZE; index += 1) {
    const claimed = await db.transaction(async (tx) => {
      const [photo] = await tx
        .select({
          id: venuePhoto.id,
          storageKey: venuePhoto.storageKey,
          attempts: venuePhoto.variantAttempts,
        })
        .from(venuePhoto)
        .where(
          and(
            isNull(venuePhoto.variantWidths),
            lt(venuePhoto.variantAttempts, MAX_ATTEMPTS),
            seen.length > 0 ? notInArray(venuePhoto.id, seen) : undefined,
          ),
        )
        .orderBy(asc(venuePhoto.createdAt), asc(venuePhoto.id))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!photo) return false;
      seen.push(photo.id);

      try {
        const original = await storage.get(photo.storageKey);
        if (!original) throw new Error('original não encontrado no storage');
        const variants = await renderVariants(original);
        for (const variant of variants) {
          await storage.put(
            photoVariantKey(photo.storageKey, variant.width),
            variant.body,
            'image/webp',
            VARIANT_CACHE_CONTROL,
          );
        }
        await tx
          .update(venuePhoto)
          .set({ variantWidths: variants.map((variant) => variant.width) })
          .where(eq(venuePhoto.id, photo.id));
        result.done += 1;
      } catch (error) {
        const attempts = photo.attempts + 1;
        await tx
          .update(venuePhoto)
          .set({ variantAttempts: sql`${venuePhoto.variantAttempts} + 1` })
          .where(eq(venuePhoto.id, photo.id));
        result.failed += 1;
        logger.warn(
          {
            photoId: photo.id,
            storageKey: photo.storageKey,
            attempts,
            givingUp: attempts >= MAX_ATTEMPTS,
            reason: reasonOf(error),
          },
          'falha ao gerar as variantes da foto',
        );
      }
      return true;
    });
    if (!claimed) break;
  }
  return result;
}
