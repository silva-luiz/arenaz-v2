// Dev runner: build once, then keep tsc and `node --watch` running together.
//
// Both processes are spawned straight from `process.execPath`, never through a
// shell. With `shell: true` the direct child is cmd.exe on Windows: it owns
// `node --watch`, which owns the API, and killing it only ends cmd.exe, so the
// watcher outlives this script and keeps respawning the API.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const tscArgs = [tscBin, '-p', 'tsconfig.build.json'];
const options = { cwd, stdio: 'inherit' };

const initial = spawnSync(process.execPath, tscArgs, options);
if (initial.status !== 0) process.exit(initial.status ?? 1);

const children = [
  spawn(
    process.execPath,
    [...tscArgs, '--watch', '--preserveWatchOutput'],
    options,
  ),
  spawn(
    process.execPath,
    ['--watch', '--env-file-if-exists=../../.env', 'dist/main.js'],
    options,
  ),
];

let exiting = false;
function shutdown(code) {
  if (exiting) return;
  exiting = true;
  for (const child of children) child.kill();
  process.exit(code);
}

for (const child of children) {
  child.on('error', () => {
    shutdown(1);
  });
  child.on('exit', (code) => {
    shutdown(code ?? 0);
  });
}
// SIGHUP is what Windows raises when the console window is closed.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    shutdown(0);
  });
}
