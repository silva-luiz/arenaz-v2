import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.factory.js';
import type { Env } from '../src/config/env.js';
import { testEnv } from './helpers.js';

const env: Env = testEnv;

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createApp(env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('health ok com banco no ar', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
  });

  it('health 503 com banco fora', async () => {
    const down = await createApp({
      ...env,
      DATABASE_URL: 'postgres://x:x@127.0.0.1:1/x',
    });
    try {
      await down.init();
      await down.getHttpAdapter().getInstance().ready();
      const res = await down.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: 'degraded', db: 'down' });
    } finally {
      await down.close();
    }
  });

  it('propaga x-request-id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-request-id': 'abc' },
    });
    expect(res.headers['x-request-id']).toBe('abc');
  });
});
