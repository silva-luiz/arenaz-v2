/** DI token of the object storage (`StoragePort`). */
export const STORAGE = Symbol('STORAGE');

/** A presigned POST: the browser sends `fields` + the file to `url`. */
export interface UploadPost {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
}

/** What `head` reports about a stored object. */
export interface StoredObject {
  size: number;
  contentType: string;
}

/**
 * Object storage for photos. The API only signs uploads and inspects or
 * deletes objects; image bytes never pass through it.
 */
export interface StoragePort {
  /**
   * Presigned POST for exactly `key`, valid for 10 minutes, that the storage
   * itself restricts to `contentType` and 1..`maxBytes` bytes.
   */
  createUploadPost(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<UploadPost>;
  /** Size and type of the stored object, or `null` when it does not exist. */
  head(key: string): Promise<StoredObject | null>;
  /** Deletes objects; keys that do not exist are not an error. */
  delete(keys: string[]): Promise<void>;
  /** Public (anonymous GET) URL of a stored object. */
  publicUrl(key: string): string;
}

/** The slice of a logger `deleteQuietly` needs. */
interface WarnLogger {
  warn(message: string): void;
}

/**
 * Deletes objects after the database change is committed. A failure only
 * leaves orphan objects behind (acceptable); the database row is already gone
 * and must not come back, so the error is logged and swallowed.
 */
export async function deleteQuietly(
  storage: StoragePort,
  keys: string[],
  logger: WarnLogger,
): Promise<void> {
  if (keys.length === 0) return;
  try {
    await storage.delete(keys);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Não foi possível apagar ${String(keys.length)} objeto(s) do storage (ficam órfãos): ${reason}`,
    );
  }
}
