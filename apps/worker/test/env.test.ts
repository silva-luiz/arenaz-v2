import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'arenaz-photos',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
};

describe('loadEnv', () => {
  it('accepts valid urls and defaults the log level and S3 options', () => {
    expect(loadEnv(valid)).toMatchObject({
      ...valid,
      LOG_LEVEL: 'info',
      S3_REGION: 'us-east-1',
      S3_FORCE_PATH_STYLE: true,
    });
  });

  it('names every bad variable', () => {
    expect(() =>
      loadEnv({ ...valid, DATABASE_URL: 'http://x', REDIS_URL: '' }),
    ).toThrow(/DATABASE_URL[\s\S]*REDIS_URL/);
  });

  it('rejects a missing REDIS_URL', () => {
    expect(() => loadEnv({ ...valid, REDIS_URL: undefined })).toThrow(
      /REDIS_URL/,
    );
  });

  it('requires the storage the photo variants are written to', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: valid.DATABASE_URL,
        REDIS_URL: valid.REDIS_URL,
        S3_ENDPOINT: 'ftp://x',
      }),
    ).toThrow(
      /S3_ENDPOINT[\s\S]*S3_BUCKET[\s\S]*S3_ACCESS_KEY_ID[\s\S]*S3_SECRET_ACCESS_KEY/,
    );
  });

  it('parses S3_FORCE_PATH_STYLE as "true" or "false" only', () => {
    expect(loadEnv({ ...valid, S3_FORCE_PATH_STYLE: 'false' })).toMatchObject({
      S3_FORCE_PATH_STYLE: false,
    });
    expect(() => loadEnv({ ...valid, S3_FORCE_PATH_STYLE: 'yes' })).toThrow(
      /S3_FORCE_PATH_STYLE/,
    );
  });
});
