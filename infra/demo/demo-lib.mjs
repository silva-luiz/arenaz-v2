// Pure helpers of `pnpm demo` (infra/demo/demo.mjs), kept apart so they can be
// tested without starting tunnels, containers or servers.
import { delimiter, join } from 'node:path';

export const WEB_PORT = 3200;
export const API_PORT = 4200;
export const MINIO_PORT = 9000;

/** The `.env` database URL pointed at the separate `arenaz_demo` database. */
export function demoDatabaseUrl(databaseUrl) {
  const url = new URL(
    databaseUrl ?? 'postgres://arenaz:arenaz@localhost:5432/arenaz',
  );
  url.pathname = '/arenaz_demo';
  return url.toString();
}

/**
 * Host ports for `docker compose`, taken from the `.env` URLs, so the
 * containers come back on the ports the apps expect.
 */
export function composePorts(base) {
  const ports = {};
  if (base.DATABASE_URL)
    ports.POSTGRES_PORT = new URL(base.DATABASE_URL).port || '5432';
  if (base.REDIS_URL) ports.REDIS_PORT = new URL(base.REDIS_URL).port || '6379';
  return ports;
}

const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

/** The quick-tunnel address cloudflared prints, or null if not in `text`. */
export function parseTunnelUrl(text) {
  const match = TUNNEL_URL.exec(text);
  // api.trycloudflare.com shows up in error lines; it is never a tunnel.
  return match && !match[0].startsWith('https://api.') ? match[0] : null;
}

/**
 * Path of the cloudflared binary: CLOUDFLARED_BIN, then PATH, then the
 * default Windows install folders. Null when none exists.
 */
export function findCloudflared({ env, platform, exists }) {
  if (env.CLOUDFLARED_BIN) {
    return exists(env.CLOUDFLARED_BIN) ? env.CLOUDFLARED_BIN : null;
  }
  const exe = platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const dirs = (env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean);
  if (platform === 'win32') {
    dirs.push(
      'C:\\Program Files (x86)\\cloudflared',
      'C:\\Program Files\\cloudflared',
    );
  }
  for (const dir of dirs) {
    const candidate = join(dir, exe);
    if (exists(candidate)) return candidate;
  }
  return null;
}

/**
 * Environment of the demo build and processes. Values already in `base`
 * (the root `.env` and the shell) are kept unless the demo must override them.
 */
export function demoEnv({ base, siteUrl, photosUrl }) {
  return {
    ...base,
    DATABASE_URL: demoDatabaseUrl(base.DATABASE_URL),
    API_PORT: String(API_PORT),
    API_URL: `http://localhost:${String(API_PORT)}`,
    WEB_PORT: String(WEB_PORT),
    WEB_ORIGIN: siteUrl,
    BETTER_AUTH_URL: siteUrl,
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_PUBLIC_DEMO_MODE: 'true',
    S3_PUBLIC_URL: `${photosUrl}/${base.S3_BUCKET ?? 'arenaz-photos'}`,
  };
}

/** Prefixes every complete line of `chunk` with `[name] `; returns the rest. */
export function prefixLines(name, pending, chunk) {
  const lines = (pending + chunk).split(/\r?\n/);
  const rest = lines.pop() ?? '';
  return { out: lines.map((line) => `[${name}] ${line}\n`).join(''), rest };
}
