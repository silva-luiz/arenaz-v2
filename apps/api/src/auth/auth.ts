import { schema, type Db } from '@arenaz/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';

const SECONDS_PER_DAY = 24 * 60 * 60;

/** Nest injection token for the Better Auth instance. */
export const AUTH = Symbol('AUTH');

export function createAuth(env: Env, db: Db, logger: FastifyBaseLogger) {
  return betterAuth({
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    // The browser reaches the API through the web app's same-origin proxy, so
    // the public base URL is the web origin.
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN, ...(env.AUTH_TRUSTED_ORIGINS ?? [])],
    // Explicit: Better Auth otherwise skips the origin check when NODE_ENV=test.
    advanced: { disableOriginCheck: false },
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    // Route Better Auth's own logging through the app logger (pino).
    logger: {
      log: (level, message, ...args) => {
        const line = `[better-auth] ${message}`;
        if (level === 'error') logger.error({ args }, line);
        else logger[level](line);
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      expiresIn: 30 * SECONDS_PER_DAY,
      updateAge: SECONDS_PER_DAY,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth['$Infer']['Session']['user'];
