import { defineConfig } from 'vitest/config';

// @vitest/coverage-v8 is a devDependency here only so pnpm resolves the same
// vitest peer variant as @arenaz/db (see apps/api/vitest.config.ts).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['@arenaz/db/test-setup'],
    // The first run pulls/starts the PostGIS and Redis containers.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
