// `pnpm demo`: runs the demo on this machine with a public link, in one command.
//
// 1. Starts Postgres, Redis and MinIO (`docker compose up --wait`).
// 2. Opens two Cloudflare quick tunnels: the site (port 3200, which also proxies
//    /api to the API) and MinIO (port 9000), because the browser loads photos
//    straight from the bucket.
// 3. Builds everything with the tunnel addresses (the web inlines them).
// 4. Seeds `arenaz_demo` when it does not exist yet, or always with `--seed`.
// 5. Starts the API (4200), the worker and the site (3200), waits until the
//    public link answers, and prints it. Ctrl+C stops everything it started.
//
// Needs Docker and cloudflared (or CLOUDFLARED_BIN). The quick-tunnel
// addresses change on every run.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  API_PORT,
  MINIO_PORT,
  WEB_PORT,
  composePorts,
  demoEnv,
  findCloudflared,
  parseTunnelUrl,
  prefixLines,
} from './demo-lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const rootEnvFile = fileURLToPath(new URL('../../.env', import.meta.url));
const demoEnvFile = fileURLToPath(new URL('./.env.demo', import.meta.url));
const isWindows = process.platform === 'win32';
const children = [];
let stopping = false;

const log = (message) => process.stdout.write(`[demo] ${message}\n`);

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // pnpm and next spawn their own children: kill the whole tree.
    if (isWindows) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
      });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

function fail(message) {
  process.stderr.write(`[demo] ${message}\n`);
  shutdown(1);
}

process.on('SIGINT', () => {
  log('desligando…');
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));

/**
 * `pnpm` reuses the pnpm that launched `pnpm demo` (npm_execpath: a native
 * binary, or a JS file run through Node), so no shell is needed: Windows
 * cannot spawn the pnpm.cmd shim without one. Other commands (docker,
 * cloudflared) are real executables.
 */
function commandLine(command, args) {
  const pnpm = process.env.npm_execpath;
  if (command !== 'pnpm' || !pnpm) return [command, args];
  return /\.[cm]?js$/.test(pnpm)
    ? [process.execPath, [pnpm, ...args]]
    : [pnpm, args];
}

/** Runs a command to completion with inherited output; fails the demo on error. */
function run(command, args, env) {
  const [file, argv] = commandLine(command, args);
  const result = spawnSync(file, argv, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`falhou: ${command} ${args.join(' ')}`);
  }
}

/** Starts a long-running process whose output is prefixed with `[name]`. */
function start(name, command, args, env, { quiet = false } = {}) {
  const [file, argv] = commandLine(command, args);
  const child = spawn(file, argv, { cwd: root, env });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      const lines = prefixLines(name, rest, chunk);
      rest = lines.rest;
      if (!quiet) process.stdout.write(lines.out);
    });
  }
  child.on('exit', (code) => {
    if (!stopping) fail(`${name} parou (código ${String(code)}).`);
  });
  return child;
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function openTunnel(cloudflared, name, port) {
  const child = start(
    name,
    cloudflared,
    ['tunnel', '--no-autoupdate', '--url', `http://localhost:${String(port)}`],
    process.env,
    { quiet: true },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`o ${name} não recebeu endereço em 60 s`)),
      60_000,
    );
    const onData = (chunk) => {
      const url = parseTunnelUrl(String(chunk));
      if (!url) return;
      clearTimeout(timer);
      resolve(url);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  });
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

function demoDatabaseExists() {
  const result = spawnSync(
    'docker',
    [
      'compose',
      '-f',
      'infra/docker-compose.yml',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'arenaz',
      '-d',
      'postgres',
      '-tAc',
      "select 1 from pg_database where datname = 'arenaz_demo'",
    ],
    { cwd: root, encoding: 'utf8' },
  );
  return result.status === 0 && result.stdout.trim() === '1';
}

/** DEMO_PASSWORD from infra/demo/.env.demo, created on the first run. */
function demoPassword() {
  if (!existsSync(demoEnvFile)) {
    const password = randomBytes(18).toString('base64url');
    writeFileSync(demoEnvFile, `DEMO_PASSWORD=${password}\n`);
    log('senha das contas demo criada em infra/demo/.env.demo');
  }
  process.loadEnvFile(demoEnvFile);
  return process.env.DEMO_PASSWORD;
}

async function main() {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

  const cloudflared = findCloudflared({
    env: process.env,
    platform: process.platform,
    exists: existsSync,
  });
  if (!cloudflared) {
    fail(
      'cloudflared não encontrado. Instale (winget install Cloudflare.cloudflared) ou defina CLOUDFLARED_BIN.',
    );
  }
  for (const port of [WEB_PORT, API_PORT]) {
    if (await portInUse(port)) {
      fail(
        `a porta ${String(port)} já está em uso: desligue a demo anterior primeiro.`,
      );
    }
  }

  log('subindo Postgres, Redis e MinIO…');
  run(
    'docker',
    ['compose', '-f', 'infra/docker-compose.yml', 'up', '-d', '--wait'],
    { ...process.env, ...composePorts(process.env) },
  );

  log('abrindo os túneis…');
  const [siteUrl, photosUrl] = await Promise.all([
    openTunnel(cloudflared, 'túnel-site', WEB_PORT),
    openTunnel(cloudflared, 'túnel-fotos', MINIO_PORT),
  ]);
  const env = demoEnv({ base: process.env, siteUrl, photosUrl });

  log('compilando…');
  // --force: the web inlines the tunnel URLs, which change on every run.
  run(
    'pnpm',
    [
      'turbo',
      'run',
      'build',
      '--env-mode=loose',
      '--force',
      '--output-logs=errors-only',
    ],
    env,
  );

  if (process.argv.includes('--seed') || !demoDatabaseExists()) {
    log('preenchendo o banco arenaz_demo…');
    run('pnpm', ['--filter', '@arenaz/api', 'demo:seed'], {
      ...env,
      DEMO_PASSWORD: demoPassword(),
    });
  }

  log('ligando API, worker e site…');
  start('api', 'pnpm', ['--filter', '@arenaz/api', 'start'], env);
  start('worker', 'pnpm', ['--filter', '@arenaz/worker', 'start'], env);
  start('site', 'pnpm', ['--filter', '@arenaz/web', 'start'], env);

  const apiUp = await waitFor(
    `http://localhost:${String(API_PORT)}/api/health`,
    60_000,
  );
  const siteUp = await waitFor(`http://localhost:${String(WEB_PORT)}/`, 60_000);
  if (!apiUp || !siteUp) fail('a API ou o site não responderam em 60 s.');
  const publicUp = await waitFor(`${siteUrl}/`, 90_000);

  log('');
  log(`ArenaZ demo no ar: ${siteUrl}`);
  if (!publicUp)
    log(
      '(o link público ainda não respondeu; pode levar mais alguns segundos)',
    );
  log(
    'Contas: marcos@demo.arenaz.test (dono) e jogador@demo.arenaz.test (jogador),',
  );
  log('        senha em infra/demo/.env.demo');
  log('Ctrl+C desliga tudo. O link muda a cada vez que a demo sobe.');
  log('');
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
