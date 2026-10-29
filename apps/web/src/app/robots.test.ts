import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('allows the site and blocks the panel, the account and the API', () => {
    const { rules, sitemap } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;

    expect(rule?.userAgent).toBe('*');
    expect(rule?.allow).toBe('/');
    expect(rule?.disallow).toEqual([
      '/painel',
      '/conta',
      '/entrar',
      '/cadastro',
      '/api/',
    ]);
    expect(sitemap).toBe('http://localhost:3000/sitemap.xml');
  });
});
