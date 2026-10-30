import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Db = NodePgDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Called when an idle client errors (e.g. the database restarts). */
  onError?: (error: Error) => void;
}

export function createDb(
  url: string,
  options: CreateDbOptions = {},
): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url });
  // pg emits 'error' on the pool when an idle client is dropped; without a
  // listener Node would treat it as unhandled and crash the process.
  const onError =
    options.onError ??
    ((error: Error): void => {
      console.error(
        'Erro em conexão ociosa do pool do Postgres:',
        error.message,
      );
    });
  pool.on('error', onError);
  const db = drizzle(pool, { schema });
  return { db, pool };
}
