import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { Env } from '../config/env.js';
import type { StoragePort, StoredObject, UploadPost } from './storage.port.js';

/** How long a presigned POST stays valid. */
const UPLOAD_TTL_SECONDS = 10 * 60;
/** S3's DeleteObjects takes at most 1000 keys per call. */
const DELETE_BATCH = 1000;

type S3Config = Pick<
  Env,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_PUBLIC_URL'
  | 'S3_FORCE_PATH_STYLE'
>;

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, $metadata } = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: number };
  };
  return name === 'NotFound' || $metadata?.httpStatusCode === 404;
}

/** `StoragePort` on any S3-compatible service (MinIO locally, S3 in prod). */
export class S3Storage implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(config: S3Config) {
    this.bucket = config.S3_BUCKET;
    this.publicBase = config.S3_PUBLIC_URL.replace(/\/+$/, '');
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
    });
  }

  async createUploadPost(
    key: string,
    contentType: string,
    maxBytes: number,
  ): Promise<UploadPost> {
    const expiresAt = new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000);
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      // Becomes both the `key` field and an exact-match policy condition.
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', 1, maxBytes],
        { 'Content-Type': contentType },
      ],
      Expires: UPLOAD_TTL_SECONDS,
    });
    return { url, fields, expiresAt };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: out.ContentLength ?? 0,
        contentType: out.ContentType ?? '',
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async readHead(key: string, bytes: number): Promise<Uint8Array | null> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${String(bytes - 1)}`,
        }),
      );
      return (await out.Body?.transformToByteArray()) ?? new Uint8Array();
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(keys: string[]): Promise<void> {
    for (let start = 0; start < keys.length; start += DELETE_BATCH) {
      const batch = keys.slice(start, start + DELETE_BATCH);
      const out = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      const failed = out.Errors?.[0];
      if (failed) {
        throw new Error(
          `Falha ao apagar ${failed.Key ?? '?'}: ${failed.Message ?? failed.Code ?? 'erro desconhecido'}`,
        );
      }
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  /** Closes the client's sockets (tests, shutdown). */
  destroy(): void {
    this.client.destroy();
  }
}
