import type { Db } from '@arenaz/db';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Logger } from 'pino';
import { expireHolds } from './expire-holds.js';
import { makePhotoVariants } from './photo-variants.js';
import type { PhotoStorage } from './storage.js';

export const QUEUE_NAME = 'maintenance';
export const EXPIRE_HOLDS_JOB = 'expire-holds';
export const EXPIRE_HOLDS_EVERY_MS = 30_000;
export const PHOTO_VARIANTS_JOB = 'photo-variants';
export const PHOTO_VARIANTS_EVERY_MS = 10_000;

export interface MaintenanceOptions {
  db: Db;
  redisUrl: string;
  logger: Logger;
  /** Where the photos live (originals read, variants written). */
  storage: PhotoStorage;
  /** Overridable so tests do not share a queue. */
  queueName?: string;
  everyMs?: number;
  photoVariantsEveryMs?: number;
}

export interface Maintenance {
  close: () => Promise<void>;
}

/** ioredis options from a redis:// or rediss:// URL. */
export function redisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const db = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username
      ? { username: decodeURIComponent(parsed.username) }
      : {}),
    ...(parsed.password
      ? { password: decodeURIComponent(parsed.password) }
      : {}),
    ...(Number.isInteger(db) && db > 0 ? { db } : {}),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

/**
 * Schedules the repeatable `expire-holds` and `photo-variants` jobs and starts
 * the worker (one job at a time). `upsertJobScheduler` with a fixed id is
 * idempotent, so restarting (or running two instances) never duplicates a
 * schedule.
 */
export async function startMaintenance(
  options: MaintenanceOptions,
): Promise<Maintenance> {
  const { db, redisUrl, logger, storage } = options;
  const queueName = options.queueName ?? QUEUE_NAME;
  const connection = redisConnection(redisUrl);

  const queue = new Queue(queueName, { connection });
  queue.on('error', (error) => {
    logger.error({ err: error }, 'erro na fila');
  });
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === EXPIRE_HOLDS_JOB) {
        const expired = await expireHolds(db);
        if (expired > 0) logger.info({ expired }, 'reservas expiradas');
      } else if (job.name === PHOTO_VARIANTS_JOB) {
        const { done, failed } = await makePhotoVariants(db, storage, logger);
        if (done + failed > 0) {
          logger.info({ done, failed }, 'variantes de fotos processadas');
        }
      }
    },
    { connection, concurrency: 1 },
  );
  worker.on('error', (error) => {
    logger.error({ err: error }, 'erro no worker');
  });
  worker.on('failed', (job, error) => {
    logger.error({ err: error, job: job?.name }, 'job falhou');
  });

  try {
    await queue.upsertJobScheduler(
      EXPIRE_HOLDS_JOB,
      { every: options.everyMs ?? EXPIRE_HOLDS_EVERY_MS },
      {
        name: EXPIRE_HOLDS_JOB,
        opts: { removeOnComplete: true, removeOnFail: 100 },
      },
    );
    await queue.upsertJobScheduler(
      PHOTO_VARIANTS_JOB,
      { every: options.photoVariantsEveryMs ?? PHOTO_VARIANTS_EVERY_MS },
      {
        name: PHOTO_VARIANTS_JOB,
        opts: { removeOnComplete: true, removeOnFail: 100 },
      },
    );
    await worker.waitUntilReady();
  } catch (error) {
    await Promise.allSettled([worker.close(), queue.close()]);
    throw error;
  }
  logger.info({ queue: queueName }, 'worker de manutenção iniciado');

  return {
    close: async (): Promise<void> => {
      await worker.close();
      await queue.close();
    },
  };
}
