import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `server-only` throws outside React's server condition; it is a build-time guard.
vi.mock('server-only', () => ({}));

afterEach(() => {
  cleanup();
});
