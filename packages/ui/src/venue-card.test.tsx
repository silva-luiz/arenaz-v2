import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VenueCard, type VenueCardProps } from './venue-card';

const BASE: VenueCardProps = {
  href: '/espacos/arena-vila',
  name: 'Arena Vila Madalena',
  neighborhood: 'Vila Madalena',
  city: 'São Paulo',
  coverUrl: 'https://cdn.example.com/capa.jpg',
  sports: ['futebol_society', 'futsal'],
  minPriceCentsPerHour: 18000,
};

describe('VenueCard', () => {
  it('is a single link named after the venue', () => {
    render(<VenueCard {...BASE} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Arena Vila Madalena');
    expect(links[0]).toHaveAttribute('href', '/espacos/arena-vila');
  });

  it('shows place, sports and the from-price as description text', () => {
    const { container } = render(<VenueCard {...BASE} />);
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeVisible();
    expect(screen.getByText('Society · Futsal')).toBeVisible();
    expect(container).toHaveTextContent('a partir de R$ 180 / hora');
  });

  it('has nothing interactive inside the link', () => {
    render(<VenueCard {...BASE} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('link').querySelector('a, button')).toBeNull();
  });

  it('renders a decorative lazy image', () => {
    const { container } = render(<VenueCard {...BASE} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/capa.jpg');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('falls back to a neutral tile with the logo glyph without a photo', () => {
    const { container } = render(<VenueCard {...BASE} coverUrl={null} />);
    expect(container.querySelector('img')).toBeNull();
    const tile = screen.getByTestId('venue-card-fallback');
    expect(tile).toHaveClass('bg-surface');
    expect(tile.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the distance in pt-BR only when provided', () => {
    const { rerender } = render(<VenueCard {...BASE} />);
    expect(screen.queryByText(/km/)).toBeNull();

    rerender(<VenueCard {...BASE} distanceKm={1.2} />);
    expect(screen.getByText('1,2 km')).toBeVisible();

    rerender(<VenueCard {...BASE} distanceKm={0} />);
    expect(screen.getByText('0,0 km')).toBeVisible();
  });

  it('lifts on hover and scales the photo, all disabled under reduced motion', () => {
    const { container } = render(<VenueCard {...BASE} />);
    const link = screen.getByRole('link');
    expect(link.className).toContain('hover:-translate-y-1');
    expect(link.className).toContain('motion-reduce:hover:translate-y-0');
    expect(link.className).toContain('motion-reduce:transition-none');
    const img = container.querySelector('img');
    expect(img?.className).toContain('group-hover:scale-105');
    expect(img?.className).toContain('motion-reduce:group-hover:scale-100');
  });

  it('uses the injected link component', () => {
    function Custom(props: React.ComponentProps<'a'>) {
      return <a data-custom="yes" {...props} />;
    }
    render(<VenueCard {...BASE} linkComponent={Custom} />);
    expect(screen.getByRole('link')).toHaveAttribute('data-custom', 'yes');
  });
});
