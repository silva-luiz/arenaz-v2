import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// Resolved relative to this file (src/ or dist/), never the process cwd, so
// other packages can call runMigrations through `@arenaz/db/test-setup`.
const migrationsFolder = fileURLToPath(
  new URL('../migrations', import.meta.url),
);

export async function runMigrations(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
