// Dev runner: build once, then keep tsc and `node --watch` running together.
// A plain `a & b` package script does not work on Windows (cmd.exe).
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const tsc = ['tsc', '-p', 'tsconfig.build.json'];
const options = { stdio: 'inherit', shell: true };

const initial = spawnSync('pnpm', ['exec', ...tsc], options);
if (initial.status !== 0) process.exit(initial.status ?? 1);

const children = [
  spawn('pnpm', ['exec', ...tsc, '--watch', '--preserveWatchOutput'], options),
  spawn(
    'node',
    ['--watch', '--env-file-if-exists=../../.env', 'dist/main.js'],
    options,
  ),
];

function stop() {
  for (const child of children) child.kill();
}
for (const child of children) {
  child.on('exit', (code) => {
    stop();
    process.exit(code ?? 0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
