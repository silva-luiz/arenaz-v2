import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';

const cwd = new URL('..', import.meta.url);

beforeAll(() => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const build = spawnSync(
    process.execPath,
    [tsc, '-p', 'tsconfig.build.json'],
    { cwd, encoding: 'utf8' },
  );
  if (build.status !== 0) throw new Error(build.stdout + build.stderr);
}, 120_000);

describe('main', () => {
  it('exits 1 within a bound, with a clear message, when Redis is unreachable', async () => {
    const child = spawn(process.execPath, ['dist/main.js'], {
      cwd,
      env: {
        PATH: process.env['PATH'],
        DATABASE_URL: 'postgres://u:p@127.0.0.1:1/db',
        REDIS_URL: 'redis://127.0.0.1:1',
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_BUCKET: 'arenaz-photos',
        S3_ACCESS_KEY_ID: 'x',
        S3_SECRET_ACCESS_KEY: 'x',
        LOG_LEVEL: 'silent',
      },
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const started = Date.now();
    const code = await new Promise<number | null>((resolve) => {
      const kill = setTimeout(() => {
        child.kill();
      }, 12_000);
      child.on('exit', (c) => {
        clearTimeout(kill);
        resolve(c);
      });
    });

    expect(code).toBe(1);
    expect(Date.now() - started).toBeLessThan(11_000);
    expect(stderr).toMatch(/Redis inacessível/);
  }, 20_000);
});
