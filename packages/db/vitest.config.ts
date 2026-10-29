import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./src/test-setup.ts'],
    // The first run pulls/starts the PostGIS container.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
