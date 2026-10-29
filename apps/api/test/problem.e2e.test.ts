import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../src/app.factory.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createApp({
    DATABASE_URL: inject('DATABASE_URL'),
    REDIS_URL: 'redis://localhost:6379',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    API_PORT: 4000,
    WEB_ORIGIN: 'http://localhost:3000',
    NODE_ENV: 'test',
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

describe('problem+json', () => {
  it('404 em problem+json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.json()).toMatchObject({ status: 404, title: 'Não encontrado' });
  });
});
