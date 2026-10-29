import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { AUTH, type Auth } from './auth/auth.js';
import { registerAuthRoutes } from './auth/auth.routes.js';
import { PinoNestLogger } from './common/nest-logger.js';
import { ProblemFilter } from './common/problem.filter.js';
import type { Env } from './config/env.js';

const REQUEST_ID_HEADER = 'x-request-id';
/** Only well-formed incoming ids are trusted; anything else gets a fresh UUID. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

export async function createApp(env: Env): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
    genReqId: (req: IncomingMessage) => {
      const incoming = req.headers[REQUEST_ID_HEADER];
      return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming)
        ? incoming
        : randomUUID();
    },
  });
  const fastify = adapter.getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(
      env,
      {
        url: env.DATABASE_URL,
        onError: (error) => {
          fastify.log.error(
            { err: error },
            'Erro em conexão ociosa do Postgres',
          );
        },
      },
      fastify.log,
    ),
    adapter,
    { logger: new PinoNestLogger(fastify.log) },
  );

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ProblemFilter());
  await app.register(helmet);
  if (env.NODE_ENV !== 'test') {
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  }
  // After helmet and rate limiting so the route inherits both.
  registerAuthRoutes(fastify, app.get<Auth>(AUTH));
  app.enableShutdownHooks();
  return app;
}
