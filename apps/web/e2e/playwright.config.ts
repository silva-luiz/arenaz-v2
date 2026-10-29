import { defineConfig, devices } from '@playwright/test';

// Dedicated ports so the suite never collides with (or attaches to) a dev
// server that may already be running on 3000/4000.
const webPort = Number(process.env.E2E_WEB_PORT ?? 3100);
const apiPort = Number(process.env.E2E_API_PORT ?? 4100);
const webOrigin = `http://localhost:${String(webPort)}`;
const apiOrigin = `http://localhost:${String(apiPort)}`;

// Fixed TEST value (not a secret); only used against the throwaway e2e servers.
const TEST_AUTH_SECRET =
  'e2e-only-test-secret-not-for-production-use-0123456789';

const isCI = Boolean(process.env.CI);

// Playwright merges these over `process.env`. `DATABASE_URL` is forwarded when
// set; otherwise the apps fall back to the monorepo root `.env`.
const sharedEnv: Record<string, string> = {
  NODE_ENV: 'production',
  API_PORT: String(apiPort),
  API_URL: apiOrigin,
  WEB_ORIGIN: webOrigin,
  BETTER_AUTH_URL: webOrigin,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? TEST_AUTH_SECRET,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  ...(process.env.DATABASE_URL === undefined
    ? {}
    : { DATABASE_URL: process.env.DATABASE_URL }),
};

// The owner flow uploads real photos: the browser POSTs straight to object
// storage through a presigned POST policy. Taken from the environment when set (CI),
// else the local compose MinIO. These are dev/test values, not secrets.
const storageEnv: Record<string, string> = {
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  S3_REGION: process.env.S3_REGION ?? 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET ?? 'arenaz-photos',
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
  S3_PUBLIC_URL:
    process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/arenaz-photos',
  S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE ?? 'true',
};

// Only the API runs with NODE_ENV=test: that is what allows the fake CEP
// provider (refused in production), which keeps the suite off the network.
// The web app stays in production mode (`next build` / `next start`).
const apiEnv: Record<string, string> = {
  ...sharedEnv,
  ...storageEnv,
  NODE_ENV: 'test',
  GEO_PROVIDER: 'fake',
};

// Shared packages (contracts, db) and the API are built once, before
// Playwright starts, by the turbo `e2e` task (`dependsOn` in turbo.json). Each
// command below then only builds or starts its own app, so no two `tsc` runs
// ever write the same `dist`. The web build runs outside the turbo cache
// because the `/api/*` rewrite destination (`API_URL`) is baked into it.
const SERVER_TIMEOUT_MS = 5 * 60 * 1000;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        'pnpm --filter @arenaz/db migrate && pnpm --filter @arenaz/api start',
      url: `${apiOrigin}/api/health`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: SERVER_TIMEOUT_MS,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command:
        'node helpers/clear-data-cache.mjs && pnpm --filter @arenaz/web build && pnpm --filter @arenaz/web start',
      url: `${webOrigin}/entrar`,
      env: { ...sharedEnv, WEB_PORT: String(webPort) },
      reuseExistingServer: false,
      timeout: SERVER_TIMEOUT_MS,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
