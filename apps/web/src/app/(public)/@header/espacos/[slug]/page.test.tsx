import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeField, makeVenue } from '@/test/venue-fixture';

const mocks = vi.hoisted(() => ({ publicGet: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/public-api', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/public-api')>()),
  publicGet: mocks.publicGet,
}));

import VenueHeaderSearch from './page';

function day(offset: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(Date.now() + offset * 86_400_000));
}

async function renderSlot(
  slug = 'arena-vila-madalena',
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const node = await VenueHeaderSearch({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  });
  return render(<>{node}</>);
}

function pill(): HTMLElement | null {
  return screen.queryByText('Alterar a busca:', { exact: false });
}

describe('venue page header search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.publicGet.mockResolvedValue(makeVenue());
  });

  it('fills the pill with the neighborhood, today and the first sport', async () => {
    await renderSlot();

    expect(pill()?.closest('summary')).toHaveTextContent(
      'Alterar a busca: Vila MadalenaHojeSociety',
    );
  });

  it('uses the day and the group of the link it came from', async () => {
    await renderSlot(undefined, { data: day(1), jogadores: '12' });

    expect(pill()?.closest('summary')).toHaveTextContent(
      'Vila MadalenaAmanhãSociety · 12',
    );
  });

  it('ignores a day out of range', async () => {
    await renderSlot(undefined, { data: '2020-01-01' });

    expect(pill()?.closest('summary')).toHaveTextContent('Hoje');
  });

  it('says "Qualquer esporte" for a venue without courts', async () => {
    mocks.publicGet.mockResolvedValue(makeVenue({ fields: [] }));
    await renderSlot();

    expect(pill()?.closest('summary')).toHaveTextContent('Qualquer esporte');
  });

  it('uses the sport of the first court', async () => {
    mocks.publicGet.mockResolvedValue(
      makeVenue({ fields: [makeField({ sports: ['padel', 'tenis'] })] }),
    );
    await renderSlot();

    expect(pill()?.closest('summary')).toHaveTextContent('Padel');
  });

  it('renders nothing for a venue that does not exist (the page answers 404)', async () => {
    mocks.publicGet.mockResolvedValue(null);
    const { container } = await renderSlot();

    expect(container).toBeEmptyDOMElement();
  });

  it('does not ask the API for a slug that cannot exist', async () => {
    const { container } = await renderSlot('NÃO EXISTE');

    expect(mocks.publicGet).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
