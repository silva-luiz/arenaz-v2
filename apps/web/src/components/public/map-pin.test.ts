import { describe, expect, it } from 'vitest';
import { priceIcon } from './map-pin';

function html(icon: ReturnType<typeof priceIcon>): string {
  const value = icon.options.html;
  return typeof value === 'string' ? value : '';
}

describe('priceIcon', () => {
  it('is a label with the price, drawn with a div and no image file', () => {
    const markup = html(priceIcon(18000, false));

    expect(markup).toContain('R$ 180');
    expect(markup).not.toContain('<img');
  });

  it('keeps the cents when the price is not whole reais', () => {
    expect(html(priceIcon(12050, false))).toContain('R$ 120,50');
  });

  it('is white with ink text by default and ink with white text when selected', () => {
    const idle = html(priceIcon(18000, false));
    const selected = html(priceIcon(18000, true));

    expect(idle).toContain('bg-white');
    expect(idle).toContain('text-ink');
    expect(idle).not.toContain('bg-ink');
    expect(selected).toContain('bg-ink');
    expect(selected).toContain('text-white');
  });

  it('reuses the same icon for the same state, so markers are not redrawn', () => {
    expect(priceIcon(18000, true)).toBe(priceIcon(18000, true));
    expect(priceIcon(18000, true)).not.toBe(priceIcon(18000, false));
  });
});
