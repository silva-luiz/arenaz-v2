import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composePorts,
  demoDatabaseUrl,
  demoEnv,
  findCloudflared,
  parseTunnelUrl,
  prefixLines,
} from './demo-lib.mjs';

test('parseTunnelUrl finds the quick-tunnel address in the banner line', () => {
  const line =
    '2026-10-30T09:17:13Z INF |  https://buried-valve-salad-detroit.trycloudflare.com      |';
  assert.equal(
    parseTunnelUrl(line),
    'https://buried-valve-salad-detroit.trycloudflare.com',
  );
});

test('parseTunnelUrl ignores lines without a tunnel and the API host', () => {
  assert.equal(parseTunnelUrl('INF Requesting new quick Tunnel...'), null);
  assert.equal(
    parseTunnelUrl('ERR failed to reach https://api.trycloudflare.com/tunnel'),
    null,
  );
});

test('findCloudflared prefers CLOUDFLARED_BIN', () => {
  const found = findCloudflared({
    env: { CLOUDFLARED_BIN: '/opt/cf', PATH: '/usr/bin' },
    platform: 'linux',
    exists: () => true,
  });
  assert.equal(found, '/opt/cf');
});

test('findCloudflared falls back to the Windows install folder', () => {
  const found = findCloudflared({
    env: { Path: 'C:\\Windows' },
    platform: 'win32',
    exists: (p) => p.includes('Program Files (x86)'),
  });
  assert.match(
    found,
    /Program Files \(x86\)[\\/]cloudflared[\\/]cloudflared\.exe$/,
  );
});

test('findCloudflared returns null when nothing exists', () => {
  assert.equal(
    findCloudflared({
      env: { PATH: '/usr/bin' },
      platform: 'linux',
      exists: () => false,
    }),
    null,
  );
});

test('demoEnv points at the demo database and the public tunnels', () => {
  const env = demoEnv({
    base: {
      DATABASE_URL: 'postgres://arenaz:arenaz@localhost:5433/arenaz',
      S3_BUCKET: 'arenaz-photos',
      BETTER_AUTH_SECRET: 'keep-me',
    },
    siteUrl: 'https://site.trycloudflare.com',
    photosUrl: 'https://fotos.trycloudflare.com',
  });
  assert.equal(
    env.DATABASE_URL,
    'postgres://arenaz:arenaz@localhost:5433/arenaz_demo',
  );
  assert.equal(env.WEB_ORIGIN, 'https://site.trycloudflare.com');
  assert.equal(env.BETTER_AUTH_URL, 'https://site.trycloudflare.com');
  assert.equal(env.API_URL, 'http://localhost:4200');
  assert.equal(env.WEB_PORT, '3200');
  assert.equal(env.NEXT_PUBLIC_DEMO_MODE, 'true');
  assert.equal(
    env.S3_PUBLIC_URL,
    'https://fotos.trycloudflare.com/arenaz-photos',
  );
  assert.equal(env.BETTER_AUTH_SECRET, 'keep-me');
});

test('demoDatabaseUrl swaps only the database name', () => {
  assert.equal(
    demoDatabaseUrl('postgres://arenaz:arenaz@localhost:5433/arenaz'),
    'postgres://arenaz:arenaz@localhost:5433/arenaz_demo',
  );
  assert.equal(
    demoDatabaseUrl(undefined),
    'postgres://arenaz:arenaz@localhost:5432/arenaz_demo',
  );
});

test('composePorts follows the .env URLs and defaults to the standard ports', () => {
  assert.deepEqual(
    composePorts({
      DATABASE_URL: 'postgres://arenaz:arenaz@localhost:5433/arenaz',
      REDIS_URL: 'redis://localhost:6380',
    }),
    { POSTGRES_PORT: '5433', REDIS_PORT: '6380' },
  );
  assert.deepEqual(
    composePorts({
      DATABASE_URL: 'postgres://arenaz:arenaz@localhost/arenaz',
      REDIS_URL: 'redis://localhost',
    }),
    { POSTGRES_PORT: '5432', REDIS_PORT: '6379' },
  );
  assert.deepEqual(composePorts({}), {});
});

test('prefixLines prefixes complete lines and keeps the partial one', () => {
  const first = prefixLines('api', '', 'ready\npart');
  assert.equal(first.out, '[api] ready\n');
  assert.equal(first.rest, 'part');
  const second = prefixLines('api', first.rest, 'ial\r\n');
  assert.equal(second.out, '[api] partial\n');
  assert.equal(second.rest, '');
});
