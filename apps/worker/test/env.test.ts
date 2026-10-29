import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadEnv', () => {
  it('accepts valid urls and defaults the log level', () => {
    expect(loadEnv(valid)).toMatchObject({ ...valid, LOG_LEVEL: 'info' });
  });

  it('names every bad variable', () => {
    expect(() => loadEnv({ DATABASE_URL: 'http://x', REDIS_URL: '' })).toThrow(
      /DATABASE_URL[\s\S]*REDIS_URL/,
    );
  });

  it('rejects a missing REDIS_URL', () => {
    expect(() => loadEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(
      /REDIS_URL/,
    );
  });
});
