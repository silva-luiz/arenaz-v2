import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  VenueCard,
  formatDistanceKm,
  formatFreeTime,
  type VenueCardProps,
} from './venue-card';

const BASE: VenueCardProps = {
  href: '/espacos/arena-vila',
  name: 'Arena Vila Madalena',
  imageUrl: 'https://cdn.example.com/capa.jpg',
  imageAlt: 'Campo society iluminado à noite',
  meta: 'Society · Futsal · 1,2 km',
  priceCents: 18000,
};

describe('VenueCard', () => {
  it('is a single link named after the venue', () => {
    render(<VenueCard {...BASE} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Arena Vila Madalena');
    expect(links[0]).toHaveAttribute('href', '/espacos/arena-vila');
  });

  it('shows the meta line and the price as description text', () => {
    const { container } = render(<VenueCard {...BASE} />);
    expect(screen.getByText('Society · Futsal · 1,2 km')).toBeVisible();
    expect(container).toHaveTextContent('R$ 180 / hora');
    expect(container).not.toHaveTextContent('a partir de');
    expect(screen.getByRole('link')).toHaveAccessibleDescription(
      /Society · Futsal · 1,2 km.*R\$ 180 \/ hora/,
    );
  });

  it('says "a partir de" when the price is the lowest of several', () => {
    const { container } = render(<VenueCard {...BASE} priceFrom />);
    expect(container).toHaveTextContent('a partir de R$ 180 / hora');
  });

  it('renders no badge, rating or button without nextFreeTime, rating and favorite', () => {
    const { container } = render(<VenueCard {...BASE} />);
    expect(screen.queryByText(/Livre às/)).toBeNull();
    expect(
      container.querySelector('[data-testid="venue-card-rating"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="venue-card-badge"]'),
    ).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders the photo with the given alt text, lazy', () => {
    const { container } = render(<VenueCard {...BASE} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/capa.jpg');
    expect(img).toHaveAttribute('alt', 'Campo society iluminado à noite');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('uses the 20:19 photo with the 20 px radius', () => {
    const { container } = render(<VenueCard {...BASE} />);
    const frame = container.querySelector('img')?.parentElement;
    expect(frame?.className).toContain('aspect-[20/19]');
    expect(frame?.className).toContain('rounded-photo');
  });

  it('falls back to a neutral tile with the logo glyph without a photo', () => {
    const { container } = render(<VenueCard {...BASE} imageUrl={null} />);
    expect(container.querySelector('img')).toBeNull();
    const tile = screen.getByTestId('venue-card-fallback');
    expect(tile).toHaveClass('bg-surface');
    expect(tile.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('formats distances in pt-BR', () => {
    expect(formatDistanceKm(1.2)).toBe('1,2 km');
    expect(formatDistanceKm(0)).toBe('0,0 km');
  });

  describe('free time seal', () => {
    it('formats HH:MM like the prototype: whole hours drop the minutes', () => {
      expect(formatFreeTime('20:00')).toBe('20h');
      expect(formatFreeTime('19:30')).toBe('19h30');
      expect(formatFreeTime('07:00')).toBe('7h');
      expect(formatFreeTime('00:00')).toBe('0h');
      expect(formatFreeTime('09:05')).toBe('9h05');
    });

    it('shows "Livre às 19h30" with the free dot', () => {
      render(<VenueCard {...BASE} nextFreeTime="19:30" />);
      const seal = screen.getByText('Livre às 19h30');
      expect(seal).toBeVisible();
      expect(seal.closest('.az-glass')).not.toBeNull();
      expect(
        seal.querySelector('[data-testid="venue-card-free-dot"]'),
      ).toHaveClass('bg-free');
    });

    it('shows "Livre às 20h" for 20:00', () => {
      render(<VenueCard {...BASE} nextFreeTime="20:00" />);
      expect(screen.getByText('Livre às 20h')).toBeVisible();
    });

    it('is part of the link description', () => {
      render(<VenueCard {...BASE} nextFreeTime="20:00" />);
      expect(screen.getByRole('link')).toHaveAccessibleDescription(
        /Livre às 20h/,
      );
    });

    it('is absent when nextFreeTime is null', () => {
      render(<VenueCard {...BASE} nextFreeTime={null} />);
      expect(screen.queryByText(/Livre às/)).toBeNull();
    });
  });

  describe('rating and badge', () => {
    it('shows the rating next to the name only when given', () => {
      render(<VenueCard {...BASE} rating="4,92" />);
      const rating = screen.getByTestId('venue-card-rating');
      expect(rating).toHaveTextContent('4,92');
      expect(rating.querySelector('svg')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(screen.getByRole('link')).toHaveAccessibleDescription(/Nota 4,92/);
    });

    it('shows the badge as a glass pill on the photo', () => {
      render(<VenueCard {...BASE} badge="Preferido da galera" />);
      const badge = screen.getByText('Preferido da galera');
      expect(badge).toBeVisible();
      expect(badge).toHaveClass('az-glass');
    });
  });

  describe('favorite button', () => {
    it('is a button outside the link, named "Salvar nos favoritos"', () => {
      render(
        <VenueCard
          {...BASE}
          favorite={{ pressed: false, onToggle: vi.fn() }}
        />,
      );
      const button = screen.getByRole('button', {
        name: 'Salvar nos favoritos',
      });
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('link')).not.toContainElement(button);
      expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('is named "Remover dos favoritos" and pressed when saved', () => {
      render(
        <VenueCard {...BASE} favorite={{ pressed: true, onToggle: vi.fn() }} />,
      );
      expect(
        screen.getByRole('button', { name: 'Remover dos favoritos' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls onToggle on click and does not follow the link', async () => {
      const onToggle = vi.fn();
      render(<VenueCard {...BASE} favorite={{ pressed: false, onToggle }} />);

      await userEvent.click(
        screen.getByRole('button', { name: 'Salvar nos favoritos' }),
      );

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('is reachable and activatable by keyboard', async () => {
      const onToggle = vi.fn();
      render(<VenueCard {...BASE} favorite={{ pressed: false, onToggle }} />);

      await userEvent.tab(); // the link
      await userEvent.tab(); // the heart
      expect(
        screen.getByRole('button', { name: 'Salvar nos favoritos' }),
      ).toHaveFocus();
      await userEvent.keyboard('{Enter}');

      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('is a 44 px target', () => {
      render(
        <VenueCard
          {...BASE}
          favorite={{ pressed: false, onToggle: vi.fn() }}
        />,
      );
      const button = screen.getByRole('button');
      expect(button.className).toContain('size-11');
    });
  });

  it('lifts on hover and scales the photo, all disabled under reduced motion', () => {
    const { container } = render(<VenueCard {...BASE} />);
    const wrapper = screen.getByRole('link').parentElement;
    expect(wrapper?.className).toContain('hover:-translate-y-1');
    expect(wrapper?.className).toContain('motion-reduce:hover:translate-y-0');
    expect(wrapper?.className).toContain('motion-reduce:transition-none');
    const img = container.querySelector('img');
    expect(img?.className).toContain('group-hover:scale-105');
    expect(img?.className).toContain('motion-reduce:group-hover:scale-100');
  });

  describe('long names', () => {
    const LONG =
      'Complexo Esportivo Arena Society e Futsal Vila Madalena Premium';

    it('clamps a 40+ character name to two lines and keeps the rating aligned to the top', () => {
      expect(LONG.length).toBeGreaterThan(40);
      render(<VenueCard {...BASE} name={LONG} rating="4,92" />);

      const name = screen.getByText(LONG);
      expect(name).toHaveClass('line-clamp-2');
      expect(name).not.toHaveClass('truncate');
      expect(name.parentElement).toHaveClass('items-start');
      expect(screen.getByRole('link')).toHaveAccessibleName(LONG);
    });

    it('stays plain with a long name, no photo, no seal, no rating and no heart', () => {
      const { container } = render(
        <VenueCard {...BASE} name={LONG} imageUrl={null} nextFreeTime={null} />,
      );

      expect(screen.getByTestId('venue-card-fallback')).toBeVisible();
      expect(container.querySelector('img')).toBeNull();
      expect(screen.queryByText(/Livre às/)).toBeNull();
      expect(screen.queryByTestId('venue-card-rating')).toBeNull();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.getByText(LONG)).toHaveClass('line-clamp-2');
    });
  });

  it('puts className on the outer element', () => {
    const { container } = render(<VenueCard {...BASE} className="w-72" />);
    expect(container.firstElementChild).toHaveClass('w-72');
  });

  it('uses the injected link component', () => {
    function Custom(props: React.ComponentProps<'a'>) {
      return <a data-custom="yes" {...props} />;
    }
    render(<VenueCard {...BASE} linkComponent={Custom} />);
    expect(screen.getByRole('link')).toHaveAttribute('data-custom', 'yes');
  });
});
