import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn(), demo: false }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
// The demo mode is read at import time; a getter lets each test pick it.
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo;
  },
}));

import { SearchFilters } from './search-filters';

const chip = (name: string | RegExp) => screen.getByRole('button', { name });

describe('SearchFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demo = false;
  });

  it('offers the four real filters, none pressed without filters in the URL', () => {
    render(<SearchFilters params={{}} />);

    for (const name of [
      'Coberta',
      'Vestiário',
      'Estacionamento',
      'Até R$ 200/h',
    ]) {
      expect(chip(name)).toHaveAttribute('aria-pressed', 'false');
      expect(chip(name)).toBeEnabled();
    }
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('is a labelled group', () => {
    render(<SearchFilters params={{}} />);

    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument();
  });

  it('shows what the URL already filters as pressed', () => {
    render(
      <SearchFilters
        params={{ amenities: 'vestiario,coberta', maxPrice: '200' }}
      />,
    );

    expect(chip('Coberta')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Vestiário')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('Estacionamento')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('Até R$ 200/h')).toHaveAttribute('aria-pressed', 'true');
  });

  it('a price ceiling other than 200 does not press the chip', () => {
    render(<SearchFilters params={{ maxPrice: '150' }} />);

    expect(chip('Até R$ 200/h')).toHaveAttribute('aria-pressed', 'false');
  });

  it('turning an amenity on puts it in the URL, with the rest of the search', async () => {
    render(
      <SearchFilters
        params={{
          q: 'vila',
          sport: 'padel',
          data: '2026-10-30',
          jogadores: '8',
        }}
      />,
    );

    await userEvent.setup().click(chip('Coberta'));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      '/buscar?q=vila&sport=padel&data=2026-10-30&jogadores=8&amenities=coberta',
    );
  });

  it('adds to the amenities already chosen, and removes only the one turned off', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SearchFilters params={{ amenities: 'coberta' }} />,
    );

    await user.click(chip('Vestiário'));
    expect(mocks.push).toHaveBeenLastCalledWith(
      '/buscar?amenities=coberta%2Cvestiario',
    );

    rerender(<SearchFilters params={{ amenities: 'coberta,vestiario' }} />);
    await user.click(chip('Coberta'));
    expect(mocks.push).toHaveBeenLastCalledWith('/buscar?amenities=vestiario');
  });

  it('turning the last filter off leaves a clean URL', async () => {
    render(<SearchFilters params={{ amenities: 'estacionamento' }} />);

    await userEvent.setup().click(chip('Estacionamento'));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/buscar');
  });

  it('the price chip sets and clears maxPrice=200', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SearchFilters params={{ q: 'vila' }} />);

    await user.click(chip('Até R$ 200/h'));
    expect(mocks.push).toHaveBeenLastCalledWith('/buscar?q=vila&maxPrice=200');

    rerender(<SearchFilters params={{ q: 'vila', maxPrice: '200' }} />);
    await user.click(chip('Até R$ 200/h'));
    expect(mocks.push).toHaveBeenLastCalledWith('/buscar?q=vila');
  });

  it('changing a filter goes back to the first page', async () => {
    render(<SearchFilters params={{ q: 'vila', page: '3' }} />);

    await userEvent.setup().click(chip('Coberta'));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      '/buscar?q=vila&amenities=coberta',
    );
  });

  it('keeps the chips 44px tall on a phone and 40px from md', () => {
    render(<SearchFilters params={{}} />);

    expect(chip('Coberta').className).toContain('h-11');
    expect(chip('Coberta').className).toContain('md:h-10');
  });

  it('keeps the row inside the page: it scrolls on its own', () => {
    render(<SearchFilters params={{}} />);

    const group = screen.getByRole('group', { name: 'Filtros' });
    expect(group.className).toContain('overflow-x-auto');
    // Absolutely positioned (sr-only) text inside must be clipped by the row.
    expect(group.className).toContain('relative');
  });

  describe('demo mode', () => {
    beforeEach(() => {
      mocks.demo = true;
    });

    it('adds "Reserva instantânea" and "Aceita mensalista", in the prototype order', () => {
      render(<SearchFilters params={{}} />);

      expect(
        screen.getAllByRole('button').map((button) => button.textContent),
      ).toEqual([
        'Reserva instantânea (em breve)',
        'Coberta',
        'Vestiário',
        'Estacionamento',
        'Até R$ 200/h',
        'Aceita mensalista (em breve)',
      ]);
    });

    it('does not pretend to filter: both are disabled with the "Em breve" hint', async () => {
      render(<SearchFilters params={{}} />);

      for (const name of [/Reserva instantânea/, /Aceita mensalista/]) {
        expect(chip(name)).toBeDisabled();
        expect(chip(name)).toHaveAttribute('title', 'Em breve');
        expect(chip(name)).toHaveAttribute('aria-pressed', 'false');
        await userEvent.setup().click(chip(name));
      }
      expect(mocks.push).not.toHaveBeenCalled();
    });
  });

  it('has neither of the two outside the demo mode', () => {
    render(<SearchFilters params={{}} />);

    expect(screen.queryByText(/Reserva instantânea/)).toBeNull();
    expect(screen.queryByText(/mensalista/)).toBeNull();
    expect(screen.queryByText(/Em breve/i)).toBeNull();
  });
});
