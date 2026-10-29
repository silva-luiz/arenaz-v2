// Runs the Next.js CLI in-process: this script spawns nothing itself, and Next
// handles the termination signals on its own (`next dev` forks its own server
// child and cleans it up).
//
// - Loads the monorepo root `.env` (variables already set in the environment
//   win). `node --env-file` is not usable here: Next forwards the Node flags
//   to its workers through NODE_OPTIONS, which rejects `--env-file*`.
// - `WEB_PORT` picks the port (default 3000); `PORT` still wins if set. Next
//   gets exactly that port and fails loudly when it is busy, instead of moving
//   to another one: the origin must match `WEB_ORIGIN`.
import { existsSync } from 'node:fs';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

process.env.PORT ??= process.env.WEB_PORT ?? '3000';
process.argv.splice(1, 1, 'next');

await import('next/dist/bin/next');
