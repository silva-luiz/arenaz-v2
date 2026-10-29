import 'reflect-metadata';
import process from 'node:process';
import { createApp } from './app.factory.js';
import { loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await createApp(env);
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
