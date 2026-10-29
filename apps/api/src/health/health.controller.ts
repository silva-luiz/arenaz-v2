import { healthResponseSchema, type HealthResponse } from '@arenaz/contracts';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DB, type DbHandle } from '../db/db.module.js';

const DB_TIMEOUT_MS = 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  @Get()
  async check(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<HealthResponse> {
    try {
      await withTimeout(this.handle.pool.query('select 1'), DB_TIMEOUT_MS);
      return healthResponseSchema.parse({ status: 'ok', db: 'up' });
    } catch {
      void reply.status(503);
      return healthResponseSchema.parse({ status: 'degraded', db: 'down' });
    }
  }
}
