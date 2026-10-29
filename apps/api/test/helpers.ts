import { randomUUID } from 'node:crypto';
import type { VenueInput } from '@arenaz/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { inject } from 'vitest';
import { createApp } from '../src/app.factory.js';
import type { Env } from '../src/config/env.js';

export const testEnv: Env = {
  DATABASE_URL: inject('DATABASE_URL'),
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  API_PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
};

/** A ready-to-inject app wired like production (close it in `afterAll`). */
export async function buildTestApp(): Promise<NestFastifyApplication> {
  const app = await createApp(testEnv);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/**
 * Signs up a brand-new user (unique e-mail on every call, since all test
 * files share one database) and returns the session cookie and the user id.
 */
export async function signUpAs(
  app: NestFastifyApplication,
  name: string,
): Promise<{ cookie: string; userId: string }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: {
      name,
      email: `owner-${randomUUID()}@mail.com`,
      password: 'Senha@123',
    },
    // Behind the Next proxy the browser always sends its own origin.
    headers: { origin: testEnv.WEB_ORIGIN },
  });
  if (res.statusCode !== 200) {
    throw new Error(`signUpAs falhou (${String(res.statusCode)}): ${res.body}`);
  }
  const { user } = res.json<{ user: { id: string } }>();
  const cookie = res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return { cookie, userId: user.id };
}

export interface AsUser {
  get: (url: string) => Promise<LightMyRequestResponse>;
  post: (url: string, body?: object) => Promise<LightMyRequestResponse>;
  patch: (url: string, body?: object) => Promise<LightMyRequestResponse>;
  put: (url: string, body?: object) => Promise<LightMyRequestResponse>;
  del: (url: string) => Promise<LightMyRequestResponse>;
}

/** Request helpers that send the given session cookie on every call. */
export function asUser(app: NestFastifyApplication, cookie: string): AsUser {
  const send = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    body?: object,
  ): Promise<LightMyRequestResponse> =>
    app.inject({
      method,
      url,
      headers: { cookie },
      ...(body === undefined ? {} : { payload: body }),
    });
  return {
    get: (url) => send('GET', url),
    post: (url, body) => send('POST', url, body),
    patch: (url, body) => send('PATCH', url, body),
    put: (url, body) => send('PUT', url, body),
    del: (url) => send('DELETE', url),
  };
}

/** Short lowercase token to keep names (and so slugs) unique per test. */
export function uniqueToken(): string {
  return randomUUID().slice(0, 8);
}

/** A valid `POST /owner/venues` body; override any top-level field. */
export function venueBody(overrides: Partial<VenueInput> = {}): VenueInput {
  return {
    name: `Arena Teste ${uniqueToken()}`,
    description: 'Quadras de society e vôlei de praia',
    phone: '(11) 98765-4321',
    address: {
      cep: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
    location: { lat: -23.5614, lng: -46.6559 },
    amenities: ['vestiario', 'estacionamento'],
    cancellationPolicy: 'moderada',
    ...overrides,
  };
}
