import { request } from 'node:http';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApp } from '../src/app.factory.js';
import type { Env } from '../src/config/env.js';

const env: Env = {
  DATABASE_URL: inject('DATABASE_URL'),
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  API_PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
  NODE_ENV: 'test',
};

let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createApp(env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app.close();
});

// Behind the Next proxy the browser always sends its own origin.
const post = (url: string, body: object) =>
  app.inject({
    method: 'POST',
    url,
    payload: body,
    headers: { origin: env.WEB_ORIGIN },
  });
const signUp = (body: object) => post('/api/auth/sign-up/email', body);
const signIn = (body: object) => post('/api/auth/sign-in/email', body);
const cookieOf = (res: LightMyRequestResponse) =>
  res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

describe('auth e2e', () => {
  it('cadastro → /me com o cookie', async () => {
    const res = await signUp({
      name: 'Joao',
      email: 'joao@mail.com',
      password: 'Senha@123',
    });
    expect(res.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: cookieOf(res) },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ name: 'Joao', email: 'joao@mail.com' });
  });

  it('normaliza e-mail no cadastro e no login', async () => {
    await signUp({
      name: 'Ana',
      email: '  Ana@Mail.COM ',
      password: 'Senha@123',
    });
    const res = await signIn({
      email: ' ANA@mail.com',
      password: 'Senha@123',
    });
    expect(res.statusCode).toBe(200);
  });

  it('e-mail duplicado → 422 em pt-BR', async () => {
    await signUp({
      name: 'Bia',
      email: 'bia@mail.com',
      password: 'Senha@123',
    });
    const res = await signUp({
      name: 'Bia 2',
      email: 'BIA@mail.com',
      password: 'Senha@123',
    });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({
      status: 422,
      detail: 'Já existe uma conta com este e-mail',
    });
  });

  it('senha fraca → 422 com erro no campo', async () => {
    const res = await signUp({
      name: 'Caio',
      email: 'caio@mail.com',
      password: 'fraca',
    });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ title: 'Dados inválidos' });
    expect(
      res.json<{ errors: Record<string, string[]> }>().errors.password,
    ).toBeDefined();
  });

  it('senha errada no login → 401 em pt-BR', async () => {
    await signUp({
      name: 'Eva',
      email: 'eva@mail.com',
      password: 'Senha@123',
    });
    const res = await signIn({ email: 'eva@mail.com', password: 'Errada@123' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({
      status: 401,
      detail: 'E-mail ou senha inválidos',
    });
  });

  it('/me sem cookie → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      title: 'Não autenticado',
      detail: 'Faça login para continuar',
    });
  });

  it('/me com cookie adulterado → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: 'better-auth.session_token=forjado' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST com cookie e origem não confiável → 403', async () => {
    const signed = await signUp({
      name: 'Fabi',
      email: 'fabi@mail.com',
      password: 'Senha@123',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      payload: {},
      headers: { cookie: cookieOf(signed), origin: 'http://evil.example' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: cookieOf(signed) },
    });
    expect(me.statusCode).toBe(200);
  });

  it('get-session com cookie → 200 com o usuário', async () => {
    const signed = await signUp({
      name: 'Gil',
      email: 'gil@mail.com',
      password: 'Senha@123',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: cookieOf(signed) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: 'gil@mail.com' } });
  });

  it('sign-out com cookie → 200 e a sessão deixa de valer', async () => {
    const signed = await signUp({
      name: 'Hugo',
      email: 'hugo@mail.com',
      password: 'Senha@123',
    });
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      payload: {},
      headers: { cookie: cookieOf(signed), origin: env.WEB_ORIGIN },
    });
    expect(out.statusCode).toBe(200);
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: cookieOf(signed) },
    });
    expect(me.statusCode).toBe(401);
  });

  it('change-password fora da lista permitida → 404 problem+json', async () => {
    const signed = await signUp({
      name: 'Iris',
      email: 'iris@mail.com',
      password: 'Senha@123',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      payload: { currentPassword: 'Senha@123', newPassword: 'fraca' },
      headers: { cookie: cookieOf(signed), origin: env.WEB_ORIGIN },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 404, detail: 'Não encontrado' });
    const login = await signIn({
      email: 'iris@mail.com',
      password: 'Senha@123',
    });
    expect(login.statusCode).toBe(200);
  });

  it('update-user e GET de endpoint desconhecido → 404', async () => {
    const signed = await signUp({
      name: 'Jo',
      email: 'jo@mail.com',
      password: 'Senha@123',
    });
    const upd = await app.inject({
      method: 'POST',
      url: '/api/auth/update-user',
      payload: { name: '' },
      headers: { cookie: cookieOf(signed), origin: env.WEB_ORIGIN },
    });
    expect(upd.statusCode).toBe(404);
    const list = await app.inject({
      method: 'GET',
      url: '/api/auth/list-sessions',
      headers: { cookie: cookieOf(signed) },
    });
    expect(list.statusCode).toBe(404);
  });

  it('cookie de sessão é httpOnly e SameSite=Lax', async () => {
    const res = await signUp({
      name: 'Davi',
      email: 'davi@mail.com',
      password: 'Senha@123',
    });
    const c = res.cookies.find((cookie) =>
      cookie.name.includes('session_token'),
    );
    expect(c).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  });
});

// `app.inject` resolves dot segments before routing; only a real socket keeps
// the raw request path, which is how a client could try to dodge validation.
describe('auth e2e: caminhos com segmentos especiais', () => {
  let port: number;

  beforeAll(async () => {
    await app.listen(0, '127.0.0.1');
    port = Number(new URL(await app.getUrl()).port);
  });

  const raw = (path: string, body: object) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: env.WEB_ORIGIN,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: data });
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });

  const SIGN_UP_SPELLINGS = [
    '/api/auth/./sign-up/email',
    '/api/auth/x/../sign-up/email',
    '/api/auth/%2e/sign-up/email',
    '/api/auth/sign-up/%65mail',
    '/api/auth//sign-up/email/',
  ];

  it.each([
    '/api/auth/./change-password',
    '/api/auth/x/../CHANGE-PASSWORD/',
    '/api/auth/%63hange-password',
  ])('change-password em %s → 404', async (path) => {
    const res = await raw(path, { newPassword: 'fraca', currentPassword: 'x' });
    expect(res.status).toBe(404);
  });

  it.each(SIGN_UP_SPELLINGS)('senha fraca em %s → 422', async (path) => {
    const res = await raw(path, {
      name: 'Dot',
      email: 'dot-weak@mail.com',
      password: 'aaaaaaaa',
    });
    expect(res.status).toBe(422);
    expect(JSON.parse(res.body)).toMatchObject({ title: 'Dados inválidos' });
  });

  it('cadastro e login por caminho com ponto normalizam o e-mail', async () => {
    const up = await raw('/api/auth/./sign-up/email', {
      name: 'Dot',
      email: '  Dot@Mail.COM ',
      password: 'Senha@123',
    });
    expect(up.status).toBe(200);
    expect(JSON.parse(up.body)).toMatchObject({
      user: { email: 'dot@mail.com' },
    });

    const noTrim = await raw('/api/auth/x/../sign-in/email', {
      email: '  Dot@Mail.COM ',
      password: 'Senha@123',
    });
    expect(noTrim.status).toBe(200);
  });
});
