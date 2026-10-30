import { describe, expect, it } from 'vitest';
import { pinLabel, priceIcon } from './map-pin';

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

  it('matches the prototype pin: 14px bold, 32px tall, soft shadow, selected scales up', () => {
    const idle = html(priceIcon(18000, false));
    const selected = html(priceIcon(18000, true));

    for (const markup of [idle, selected]) {
      expect(markup).toContain('min-h-8');
      expect(markup).toContain('text-sm');
      expect(markup).toContain('font-bold');
    }
    expect(idle).toContain('border-line-strong');
    expect(selected).toContain('scale-[1.08]');
    expect(idle).not.toContain('scale-');
  });

  it('is at least 44px to hit on a phone, and shows a focus ring when the pin has focus', () => {
    const markup = html(priceIcon(18000, false));

    expect(markup).toContain('after:-inset-y-1.5');
    expect(markup).toContain('after:-inset-x-2');
    expect(markup).toContain('leaflet-marker-icon:focus-visible');
  });
});

describe('priceIcon markup', () => {
  it('has no quote inside the class attribute (it would cut the classes short)', () => {
    for (const selected of [false, true]) {
      const holder = document.createElement('div');
      holder.innerHTML = html(priceIcon(18000, selected));
      const span = holder.querySelector('span');
      const classes = span?.getAttribute('class') ?? '';

      expect(span?.attributes).toHaveLength(1);
      expect(classes).toContain(selected ? 'bg-ink' : 'bg-white');
      expect(classes).toContain('motion-reduce:transition-none');
      expect(classes).toContain('focus-visible');
    }
  });
});

describe('pinLabel', () => {
  it('names the venue and the price per hour', () => {
    expect(pinLabel('Arena Vila Madalena', 18000)).toBe(
      'Arena Vila Madalena, R$ 180 por hora',
    );
  });

  it('keeps the cents when the price is not whole reais', () => {
    expect(pinLabel('Quadra 7', 12050)).toBe('Quadra 7, R$ 120,50 por hora');
  });

  it('writes the no-break space of the price as a plain one, for screen readers', () => {
    expect(pinLabel('A', 18000)).not.toContain(' ');
  });
});
