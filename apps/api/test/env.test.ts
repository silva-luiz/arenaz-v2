import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const valid = {
  DATABASE_URL: 'postgres://arenaz:arenaz@localhost:5432/arenaz',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  API_PORT: '4000',
  WEB_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
};

describe('loadEnv', () => {
  it('lista variáveis faltando', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it('rejeita secret curto', () => {
    expect(() => loadEnv({ ...valid, BETTER_AUTH_SECRET: 'abc' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('API_PORT padrão 4000', () => {
    expect(loadEnv({ ...valid, API_PORT: undefined }).API_PORT).toBe(4000);
  });
});
