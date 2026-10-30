import { defineConfig } from 'vitest/config';

// @vitest/coverage-v8 is a devDependency here only so pnpm resolves the same
// vitest peer variant as @arenaz/booking-core. With different variants the
// `ProvidedContext` augmentation of @arenaz/db/test-setup lands on another
// vitest copy and api typecheck fails (TS2345 on inject('DATABASE_URL')).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./src/test-setup.ts'],
    // The first run pulls/starts the PostGIS container.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
