import type { PublicVenueCard } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const demo = vi.hoisted(() => ({ on: false }));
// The demo mode is read at import time; a getter lets each test pick it.
vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return demo.on;
    },
    demoVenueExtras: (slug: string) =>
      demo.on ? (fixtures.DEMO_VENUE_EXTRAS[slug] ?? null) : null,
  };
});

import { MapPreview } from './map-preview';

function venue(overrides: Partial<PublicVenueCard> = {}): PublicVenueCard {
  return {
    slug: 'arena-vila-madalena',
    name: 'Arena Vila Madalena',
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: 'http://img.test/vm.jpg',
    coverSrcSet: 'http://img.test/vm.w400.webp 400w',
    sports: ['futebol_society'],
    minPriceCentsPerHour: 18000,
    approxLocation: { lat: -23.55, lng: -46.69 },
    distanceKm: 1.2,
    nextFreeTime: '20:00',
    freeTimes: ['20:00'],
    ...overrides,
  };
}

const HREF = '/espacos/arena-vila-madalena?data=2026-10-30&jogadores=14';

describe('MapPreview', () => {
  beforeEach(() => {
    demo.on = false;
  });

  it('is one link to the venue with its date and players', () => {
    render(<MapPreview venue={venue()} href={HREF} onClose={vi.fn()} />);

    expect(
      screen.getByRole('link', { name: /Arena Vila Madalena/ }),
    ).toHaveAttribute('href', HREF);
  });

  it('shows photo, name, meta and "R$ 180 / hora · próximo às 20h"', () => {
    const { container } = render(
      <MapPreview venue={venue()} href={HREF} onClose={vi.fn()} />,
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://img.test/vm.jpg');
    expect(img).toHaveAttribute('srcset', 'http://img.test/vm.w400.webp 400w');
    expect(img).toHaveAttribute('sizes', '340px');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByText('Arena Vila Madalena')).toBeInTheDocument();
    expect(screen.getByText(/Vila Madalena · Society · 1,2 km/)).toBeVisible();
    const price = screen.getByText(/\/ hora · próximo às 20h/);
    expect(price.parentElement).toHaveTextContent(
      'R$ 180 / hora · próximo às 20h',
    );
  });

  it('writes 19:30 as 19h30', () => {
    render(
      <MapPreview
        venue={venue({ nextFreeTime: '19:30' })}
        href={HREF}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/próximo às 19h30/)).toBeInTheDocument();
  });

  it('drops the "próximo às" part without a free time today', () => {
    render(
      <MapPreview
        venue={venue({ nextFreeTime: null })}
        href={HREF}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/próximo/)).not.toBeInTheDocument();
    expect(screen.getByText('/ hora')).toBeInTheDocument();
  });

  it('falls back to the logo tile without a photo, and plain src without variants', () => {
    const { container, rerender } = render(
      <MapPreview
        venue={venue({ coverUrl: null, coverSrcSet: null })}
        href={HREF}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByTestId('map-preview-fallback')).toBeInTheDocument();

    rerender(
      <MapPreview
        venue={venue({ coverSrcSet: null })}
        href={HREF}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('img')).not.toHaveAttribute('srcset');
  });

  it('keeps a 40+ character name inside the card (two lines at most)', () => {
    const name =
      'Complexo Esportivo Municipal Professor Doutor Fulano de Tal Júnior';
    render(
      <MapPreview venue={venue({ name })} href={HREF} onClose={vi.fn()} />,
    );

    expect(screen.getByText(name).className).toContain('line-clamp-2');
  });

  describe('demo mode', () => {
    it('shows the rating of the demo fixtures next to the name', () => {
      demo.on = true;
      render(
        <MapPreview
          venue={venue({ slug: 'arena-vila-madalena' })}
          href={HREF}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('map-preview-rating')).toHaveTextContent(
        'Nota 4,92(318), 318 avaliações',
      );
    });

    it('has no hole for a venue without a fixture', () => {
      demo.on = true;
      render(
        <MapPreview
          venue={venue({ slug: 'sem-fixture' })}
          href={HREF}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('map-preview-rating')).toBeNull();
    });

    it('has no rating outside the demo mode', () => {
      render(<MapPreview venue={venue()} href={HREF} onClose={vi.fn()} />);

      expect(screen.queryByTestId('map-preview-rating')).toBeNull();
      expect(screen.queryByText(/4,92/)).toBeNull();
    });
  });

  it('closes with its 44px button, which is not inside the link', async () => {
    const onClose = vi.fn();
    render(<MapPreview venue={venue()} href={HREF} onClose={onClose} />);

    const close = screen.getByRole('button', { name: 'Fechar prévia' });
    expect(close.className).toContain('size-11');
    expect(screen.getByRole('link')).not.toContainElement(close);
    await userEvent.setup().click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
