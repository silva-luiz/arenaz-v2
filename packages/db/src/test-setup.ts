import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { runMigrations } from './migrations.js';

declare module 'vitest' {
  interface ProvidedContext {
    DATABASE_URL: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** Vitest globalSetup: throwaway PostGIS database with all migrations applied. */
export default async function setup(project: TestProject): Promise<void> {
  try {
    container = await new PostgreSqlContainer('postgis/postgis:17-3.5').start();
    const url = container.getConnectionUri();
    await runMigrations(url);
    project.provide('DATABASE_URL', url);
    process.env['DATABASE_URL'] = url;
  } catch (error) {
    // Vitest 5 crashes while mapping the stack of errors thrown from
    // globalSetup and hides the cause, so print it first. Also don't leak the
    // container when migrations fail.
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Falha no globalSetup do banco de testes: ${reason}\n`,
    );
    await teardown();
    throw error;
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
  container = undefined;
}
