import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

async function loadSite() {
  vi.resetModules();
  return import('./site');
}

describe('site url', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warn.mockRestore();
  });

  it('usa o endereço local quando não configurado', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const site = await loadSite();
    expect(site.SITE_URL).toBe('http://localhost:3000');
    expect(site.absoluteUrl('/buscar')).toBe('http://localhost:3000/buscar');
    expect(warn).not.toHaveBeenCalled();
  });

  it('aceita uma URL válida', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://arenaz.com.br');
    const site = await loadSite();
    expect(site.SITE_URL).toBe('https://arenaz.com.br');
    expect(site.absoluteUrl('/espacos/x')).toBe(
      'https://arenaz.com.br/espacos/x',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('usa só a origem de uma URL válida', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://arenaz.com.br/ignorado/');
    const site = await loadSite();
    expect(site.SITE_URL).toBe('https://arenaz.com.br');
  });

  it.each(['arenaz.com.br', 'localhost:3000', 'ftp://arenaz.com.br', '::'])(
    'cai no endereço local, avisando uma vez, com "%s"',
    async (raw) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', raw);
      const site = await loadSite();
      expect(site.SITE_URL).toBe('http://localhost:3000');
      // Used by the sitemap, robots and metadataBase: must not throw.
      expect(() => new URL(site.SITE_URL)).not.toThrow();
      expect(site.absoluteUrl('/sitemap.xml')).toBe(
        'http://localhost:3000/sitemap.xml',
      );
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );
});
