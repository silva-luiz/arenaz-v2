import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ search: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/lib/demo', () => ({ isDemoMode: false }));

import { SearchHeaderFilters, SearchSummary } from './search-header';

function day(offset: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(Date.now() + offset * 86_400_000));
}

describe('SearchSummary', () => {
  beforeEach(() => {
    mocks.search = '';
  });

  it('is a pill with place, day and sport, "Qualquer ..." when the URL has none', () => {
    render(<SearchSummary />);

    const summary = screen.getByText('Qualquer lugar').closest('summary');
    expect(summary).toHaveTextContent(
      'Alterar a busca: Qualquer lugarQualquer diaQualquer esporte',
    );
  });

  it('shows what the URL has: "Vila Madalena | Hoje | Society · 14"', () => {
    mocks.search = `q=Vila+Madalena&data=${day(0)}&sport=futebol_society&jogadores=14`;
    render(<SearchSummary />);

    const summary = screen.getByText('Vila Madalena').closest('summary');
    expect(summary).toHaveTextContent(
      'Alterar a busca: Vila MadalenaHojeSociety · 14',
    );
  });

  it('leaves the day out on a phone and the sport out below lg, never the place', () => {
    mocks.search = `q=Vila+Madalena&data=${day(0)}&sport=futebol_society`;
    render(<SearchSummary />);

    const summary = within(
      screen.getByText('Vila Madalena').closest('summary') as HTMLElement,
    );
    expect(summary.getByText('Vila Madalena')).toHaveClass('truncate');
    expect(summary.getByText('Hoje')).toHaveClass('max-md:hidden');
    expect(summary.getByText('Society')).toHaveClass('max-lg:hidden');
  });

  it('shows the search a venue page hands it instead of the URL', () => {
    mocks.search = 'q=Pinheiros&sport=padel';
    render(
      <SearchSummary
        seed={{ q: 'Vila Madalena', data: day(0), sport: 'futebol_society' }}
      />,
    );

    const summary = screen.getByText('Vila Madalena').closest('summary');
    expect(summary).toHaveTextContent(
      'Alterar a busca: Vila MadalenaHojeSociety',
    );
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveValue(
      'Vila Madalena',
    );
  });

  it('writes tomorrow and later days', () => {
    mocks.search = `data=${day(1)}`;
    const first = render(<SearchSummary />);
    const summaryOf = (container: HTMLElement) =>
      container.querySelector('summary') as HTMLElement;
    expect(
      within(summaryOf(first.container)).getByText('Amanhã'),
    ).toBeVisible();
    first.unmount();

    mocks.search = `data=${day(5)}`;
    const second = render(<SearchSummary />);
    expect(
      within(summaryOf(second.container)).getByText(
        /^[A-Z][a-zç]{2}, \d{2}\/\d{2}$/,
      ),
    ).toBeVisible();
  });

  it('says "Perto de você" for a search near a point, and ignores an invalid day', () => {
    mocks.search = 'lat=-23.55&lng=-46.69&data=2020-01-01';
    const { container } = render(<SearchSummary />);
    const summary = container.querySelector('summary') as HTMLElement;

    expect(within(summary).getByText('Perto de você')).toBeInTheDocument();
    expect(within(summary).getByText('Qualquer dia')).toBeInTheDocument();
  });

  it('starts with the action, then what it shows (the visible text is in the name)', () => {
    mocks.search = 'q=Lapa';
    render(<SearchSummary />);

    const summary = screen.getByText('Lapa').closest('summary');
    expect(summary?.textContent).toMatch(/^Alterar a busca: Lapa/);
    // At least 44px tall on a phone: the pill is 48px.
    expect(summary?.className).toContain('h-12');
  });

  it('keeps the real inputs in a panel, prefilled from the URL', () => {
    mocks.search = 'q=Lapa&sport=padel&jogadores=8';
    render(<SearchSummary />);

    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveValue('Lapa');
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveValue(
      'padel',
    );
    expect(screen.getByRole('combobox', { name: 'Jogadores' })).toHaveValue(
      '8',
    );
  });

  it('keeps the pills turned on (hidden fields), but not the page', () => {
    mocks.search = 'amenities=coberta&maxPrice=200&page=3';
    const { container } = render(<SearchSummary />);

    const form = container.querySelector('form');
    expect(form?.querySelector('input[name="amenities"]')).toHaveValue(
      'coberta',
    );
    expect(form?.querySelector('input[name="maxPrice"]')).toHaveValue('200');
    expect(form?.querySelector('input[name="page"]')).toBeNull();
  });

  it('closes with Esc and gives focus back to the pill', async () => {
    const user = userEvent.setup();
    const { container } = render(<SearchSummary />);
    const details = container.querySelector('details');
    const summary = container.querySelector('summary');
    if (!details || !summary) throw new Error('markup');

    await user.click(summary);
    expect(details.open).toBe(true);
    await user.keyboard('{Escape}');

    expect(details.open).toBe(false);
    expect(summary).toHaveFocus();
  });

  it('closes with a click outside, and stays open for a click inside', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <SearchSummary />
        <button type="button">fora</button>
      </>,
    );
    const details = container.querySelector('details');
    if (!details) throw new Error('markup');

    await user.click(container.querySelector('summary') as HTMLElement);
    await user.click(screen.getByRole('textbox', { name: 'Onde' }));
    expect(details.open).toBe(true);

    await user.click(screen.getByRole('button', { name: 'fora' }));
    expect(details.open).toBe(false);
  });
});

describe('SearchHeaderFilters', () => {
  beforeEach(() => {
    mocks.search = '';
    mocks.push.mockClear();
  });

  it('is the row of pills, 60px tall (the map starts under it)', () => {
    const { container } = render(<SearchHeaderFilters />);

    expect(container.firstElementChild).toHaveClass('h-[60px]');
    expect(
      within(screen.getByRole('group', { name: 'Filtros' })).getAllByRole(
        'button',
      ),
    ).toHaveLength(4);
  });

  it('turns a pill on keeping the rest of the URL', async () => {
    mocks.search = 'q=lapa&data=2099-01-01&jogadores=8';
    render(<SearchHeaderFilters />);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Coberta' }));

    // `data` is out of range (dropped), `q` and `jogadores` stay.
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      '/buscar?q=lapa&jogadores=8&amenities=coberta',
    );
  });
});
