import { defineConfig } from 'vitest/config';

// @vitest/coverage-v8 is a devDependency here only so pnpm resolves the same
// vitest peer variant as @arenaz/db (see apps/api/vitest.config.ts).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['@arenaz/db/test-setup', './test/minio-setup.ts'],
    // The maintenance test runs the real photo-variants job, which claims any
    // pending photo of the shared database: one file at a time keeps it from
    // processing the rows of photo-variants.test.ts.
    fileParallelism: false,
    // The first run pulls/starts the PostGIS, Redis and MinIO containers.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
