import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it.each([
    ['/conta', '/conta'],
    ['/reservas?x=1', '/reservas?x=1'],
    ['//evil.com', '/conta'],
    ['https://evil.com', '/conta'],
    ['/\\evil.com', '/conta'],
    [undefined, '/conta'],
    [null, '/conta'],
    ['', '/conta'],
    ['conta', '/conta'],
    ['/a\\b', '/conta'],
    ['/\t/evil.com', '/conta'],
    ['/\n/evil.com', '/conta'],
  ])('safeNext(%j) → %s', (input, out) => {
    expect(safeNext(input)).toBe(out);
  });

  it('uses the given fallback for unsafe values', () => {
    expect(safeNext('//evil.com', '/')).toBe('/');
  });
});
