import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits the decorator metadata that Nest's DI needs; esbuild does not.
  plugins: [swc.vite()],
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['@arenaz/db/test-setup'],
    // The first run pulls/starts the PostGIS container.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
