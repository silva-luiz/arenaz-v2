import process from 'node:process';
import { createDb } from '@arenaz/db';
import { Redis } from 'ioredis';
import pino from 'pino';
import { loadEnv } from './env.js';
import { redisConnection, startMaintenance } from './maintenance.js';
import { S3PhotoStorage } from './storage.js';

const REDIS_CHECK_TIMEOUT_MS = 5_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Rejects with a clear message when Redis does not answer a PING in time. */
async function assertRedisReachable(url: string): Promise<void> {
  const client = new Redis({
    ...redisConnection(url),
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    connectTimeout: REDIS_CHECK_TIMEOUT_MS,
  });
  // Connection errors surface through the rejected promises below.
  client.on('error', () => undefined);
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('tempo esgotado'));
        }, REDIS_CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Redis inacessível em REDIS_URL (${reason})`, {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    client.disconnect();
  }
}

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });
  const { db, pool } = createDb(env.DATABASE_URL, {
    onError: (error) => {
      logger.error({ err: error }, 'erro em conexão ociosa do Postgres');
    },
  });
  const storage = new S3PhotoStorage(env);
  /** Database pool and storage sockets, once nothing uses them anymore. */
  const release = async (): Promise<void> => {
    storage.destroy();
    await pool.end();
  };

  // Handlers go first, so a signal during startup is not lost.
  const state = { stopping: false };
  const isStopping = (): boolean => state.stopping;
  let maintenance: Awaited<ReturnType<typeof startMaintenance>> | undefined;
  const shutdown = (signal: string): void => {
    if (state.stopping) return;
    state.stopping = true;
    logger.info({ signal }, 'encerrando');
    // A close() that hangs (stuck job, dead Redis) must not keep us alive.
    setTimeout(() => {
      logger.error('encerramento excedeu o tempo limite; forçando saída');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
    // Still starting: bootstrap sees `state.stopping` and closes what it opened.
    if (!maintenance) return;
    // close() waits for the running job to finish before disconnecting.
    maintenance
      .close()
      .then(release)
      .then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error({ err: error }, 'falha ao encerrar');
          process.exit(1);
        },
      );
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      shutdown(signal);
    });
  }

  try {
    await assertRedisReachable(env.REDIS_URL);
    if (isStopping()) {
      await release();
      process.exit(0);
    }
    const started = await startMaintenance({
      db,
      redisUrl: env.REDIS_URL,
      logger,
      storage,
    });
    if (isStopping()) {
      await started.close();
      await release();
      process.exit(0);
    }
    maintenance = started;
  } catch (error) {
    await release().catch(() => undefined);
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
