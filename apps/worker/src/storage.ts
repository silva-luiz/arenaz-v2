import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Env } from './env.js';

/** The slice of the object storage the photo-variants job needs. */
export interface PhotoStorage {
  /** The whole object, or `null` when it does not exist. */
  get(key: string): Promise<Uint8Array | null>;
  put(
    key: string,
    body: Uint8Array,
    contentType: string,
    cacheControl: string,
  ): Promise<void>;
}

type S3Config = Pick<
  Env,
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
  | 'S3_FORCE_PATH_STYLE'
>;

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, $metadata } = error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    name === 'NoSuchKey' ||
    name === 'NotFound' ||
    $metadata?.httpStatusCode === 404
  );
}

/** `PhotoStorage` on any S3-compatible service (same setup as the API's). */
export class S3PhotoStorage implements PhotoStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.S3_BUCKET;
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

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return (await out.Body?.transformToByteArray()) ?? new Uint8Array();
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async put(
    key: string,
    body: Uint8Array,
    contentType: string,
    cacheControl: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  /** Closes the client's sockets (tests, shutdown). */
  destroy(): void {
    this.client.destroy();
  }
}
