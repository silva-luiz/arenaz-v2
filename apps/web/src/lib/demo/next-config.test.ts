import { afterEach, describe, expect, it, vi } from 'vitest';

/** The config reads the variable when loaded, as `next build` does. */
async function envFor(mode: string | undefined) {
  vi.resetModules();
  if (mode === undefined) vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
  else vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', mode);
  const { default: config } = await import('../../../next.config');
  return config.env?.NEXT_PUBLIC_DEMO_MODE;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('next.config env.NEXT_PUBLIC_DEMO_MODE', () => {
  it('is always set, so Next inlines it into server and client alike', async () => {
    expect(await envFor('true')).toBe('true');
    expect(await envFor('false')).toBe('false');
    expect(await envFor('TRUE')).toBe('false');
    expect(await envFor('1')).toBe('false');
    expect(await envFor(undefined)).toBe('false');
  });
});
