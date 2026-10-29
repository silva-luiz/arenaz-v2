import { randomUUID } from 'node:crypto';
import {
  PHOTO_CONTENT_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_VENUE,
  photoSchema,
  photoUploadResponseSchema,
  type Photo,
  type PhotoConfirm,
  type PhotoOrder,
  type PhotoUploadRequest,
  type PhotoUploadResponse,
} from '@arenaz/contracts';
import { schema, type VenuePhoto } from '@arenaz/db';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, count, eq, max } from 'drizzle-orm';
import { DB, type DbHandle } from '../db/db.module.js';
import {
  deleteQuietly,
  STORAGE,
  type StoragePort,
} from '../storage/storage.port.js';
import { VENUE_NOT_FOUND } from '../common/not-found.js';
import { findOwnedVenue, isUuid } from '../venues/owner.js';
import {
  assertPublishedStaysComplete,
  lockVenueStatus,
} from '../venues/publishing.js';

const { venuePhoto } = schema;

export const PHOTO_LIMIT_MESSAGE = `Limite de ${String(PHOTO_MAX_PER_VENUE)} fotos por espaço`;
export const PHOTO_INVALID_MESSAGE = 'Arquivo de foto inválido';
export const PHOTO_DUPLICATE_MESSAGE = 'Foto já registrada';
export const PHOTO_ORDER_MESSAGE = 'Envie a lista completa de fotos do espaço';
export const PHOTO_NOT_FOUND = 'Foto não encontrada';

type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/** The only extension each allowed content type may be stored under. */
const EXTENSION: Record<PhotoContentType, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function isPhotoContentType(value: string): value is PhotoContentType {
  return (PHOTO_CONTENT_TYPES as readonly string[]).includes(value);
}

/** `venues/<venueId>/<uuid>.<ext>`: nothing else is ever a valid photo key. */
function keyPattern(venueId: string): RegExp {
  return new RegExp(`^venues/${venueId}/[0-9a-f-]{36}\\.(jpg|png|webp)$`);
}

/** True for a Postgres unique violation (23505), wrapped or not by Drizzle. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === '23505') return true;
    current = cause;
  }
  return false;
}

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private toPhoto(row: VenuePhoto): Photo {
    return photoSchema.parse({
      id: row.id,
      url: this.storage.publicUrl(row.storageKey),
      position: row.position,
    });
  }

  /** Signs a direct upload; the key is generated here, never by the client. */
  async createUploadUrl(
    userId: string,
    venueId: string,
    input: PhotoUploadRequest,
  ): Promise<PhotoUploadResponse> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const [row] = await this.handle.db
      .select({ total: count() })
      .from(venuePhoto)
      .where(eq(venuePhoto.venueId, owned.id));
    if ((row?.total ?? 0) >= PHOTO_MAX_PER_VENUE) {
      throw new UnprocessableEntityException(PHOTO_LIMIT_MESSAGE);
    }
    const extension = EXTENSION[input.contentType];
    const key = `venues/${owned.id}/${randomUUID()}.${extension}`;
    const post = await this.storage.createUploadPost(
      key,
      input.contentType,
      input.size,
    );
    return photoUploadResponseSchema.parse({
      url: post.url,
      fields: post.fields,
      key,
      expiresAt: post.expiresAt.toISOString(),
    });
  }

  /**
   * Registers an uploaded object. The client only names the key, so
   * everything is checked against what the storage really holds.
   */
  async confirm(
    userId: string,
    venueId: string,
    input: PhotoConfirm,
  ): Promise<Photo> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const match = keyPattern(owned.id).exec(input.key);
    // Checked before any storage call: a foreign key never reaches HEAD.
    if (!match) throw new UnprocessableEntityException(PHOTO_INVALID_MESSAGE);

    const head = await this.storage.head(input.key);
    const contentType = head?.contentType.toLowerCase() ?? '';
    if (
      !head ||
      !isPhotoContentType(contentType) ||
      EXTENSION[contentType] !== match[1] ||
      head.size < 1 ||
      head.size > PHOTO_MAX_BYTES
    ) {
      throw new UnprocessableEntityException(PHOTO_INVALID_MESSAGE);
    }

    try {
      const created = await this.handle.db.transaction(async (tx) => {
        if ((await lockVenueStatus(tx, owned.id)) === undefined) {
          throw new NotFoundException(VENUE_NOT_FOUND);
        }
        const [existing] = await tx
          .select({ id: venuePhoto.id })
          .from(venuePhoto)
          .where(eq(venuePhoto.storageKey, input.key))
          .limit(1);
        if (existing) throw new ConflictException(PHOTO_DUPLICATE_MESSAGE);

        // With the venue row locked, count and max cannot change under us.
        const [stats] = await tx
          .select({ total: count(), last: max(venuePhoto.position) })
          .from(venuePhoto)
          .where(eq(venuePhoto.venueId, owned.id));
        if ((stats?.total ?? 0) >= PHOTO_MAX_PER_VENUE) {
          throw new UnprocessableEntityException(PHOTO_LIMIT_MESSAGE);
        }
        const [row] = await tx
          .insert(venuePhoto)
          .values({
            venueId: owned.id,
            storageKey: input.key,
            position: (stats?.last ?? -1) + 1,
          })
          .returning();
        if (!row) throw new Error('insert da foto não retornou a linha');
        return row;
      });
      return this.toPhoto(created);
    } catch (error) {
      // Safety net: the unique key also guards against any missed race.
      if (isUniqueViolation(error)) {
        throw new ConflictException(PHOTO_DUPLICATE_MESSAGE);
      }
      throw error;
    }
  }

  /** Applies a new order; `input` must list every photo of the venue once. */
  async reorder(
    userId: string,
    venueId: string,
    input: PhotoOrder,
  ): Promise<Photo[]> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    const rows = await this.handle.db.transaction(async (tx) => {
      if ((await lockVenueStatus(tx, owned.id)) === undefined) {
        throw new NotFoundException(VENUE_NOT_FOUND);
      }
      const current = await tx
        .select({ id: venuePhoto.id })
        .from(venuePhoto)
        .where(eq(venuePhoto.venueId, owned.id));
      const wanted = new Set(input.photoIds);
      const exact =
        wanted.size === input.photoIds.length &&
        wanted.size === current.length &&
        current.every((photo) => wanted.has(photo.id));
      if (!exact) throw new UnprocessableEntityException(PHOTO_ORDER_MESSAGE);

      for (const [position, id] of input.photoIds.entries()) {
        await tx
          .update(venuePhoto)
          .set({ position })
          .where(and(eq(venuePhoto.id, id), eq(venuePhoto.venueId, owned.id)));
      }
      return tx
        .select()
        .from(venuePhoto)
        .where(eq(venuePhoto.venueId, owned.id))
        .orderBy(asc(venuePhoto.position));
    });
    return rows.map((row) => this.toPhoto(row));
  }

  /**
   * Deletes a photo and closes the gap in the positions. The venue is locked
   * first and the "published stays complete" check runs last, so removing the
   * only photo of a published venue rolls everything back. The object goes
   * away only after the commit.
   */
  async remove(
    userId: string,
    venueId: string,
    photoId: string,
  ): Promise<void> {
    const owned = await findOwnedVenue(this.handle.db, venueId, userId);
    if (!isUuid(photoId)) throw new NotFoundException(PHOTO_NOT_FOUND);

    const key = await this.handle.db.transaction(async (tx) => {
      if ((await lockVenueStatus(tx, owned.id)) === undefined) {
        throw new NotFoundException(VENUE_NOT_FOUND);
      }
      const [removed] = await tx
        .delete(venuePhoto)
        .where(
          and(eq(venuePhoto.id, photoId), eq(venuePhoto.venueId, owned.id)),
        )
        .returning({ storageKey: venuePhoto.storageKey });
      if (!removed) throw new NotFoundException(PHOTO_NOT_FOUND);

      const rest = await tx
        .select({ id: venuePhoto.id, position: venuePhoto.position })
        .from(venuePhoto)
        .where(eq(venuePhoto.venueId, owned.id))
        .orderBy(
          asc(venuePhoto.position),
          asc(venuePhoto.createdAt),
          asc(venuePhoto.id),
        );
      for (const [position, photo] of rest.entries()) {
        if (photo.position === position) continue;
        await tx
          .update(venuePhoto)
          .set({ position })
          .where(eq(venuePhoto.id, photo.id));
      }
      await assertPublishedStaysComplete(tx, owned.id);
      return removed.storageKey;
    });

    await deleteQuietly(this.storage, [key], this.logger);
  }
}
