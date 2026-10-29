import process from 'node:process';
import { createDb } from '@arenaz/db';
import pino from 'pino';
import { loadEnv } from './env.js';
import { startMaintenance } from './maintenance.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const logger = pino({ level: env.LOG_LEVEL, name: 'worker' });
  const { db, pool } = createDb(env.DATABASE_URL, {
    onError: (error) => {
      logger.error({ err: error }, 'erro em conexão ociosa do Postgres');
    },
  });
  const maintenance = await startMaintenance({
    db,
    redisUrl: env.REDIS_URL,
    logger,
  });

  let stopping = false;
  const shutdown = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'encerrando');
    // close() waits for the running job to finish before disconnecting.
    maintenance
      .close()
      .then(() => pool.end())
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
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
