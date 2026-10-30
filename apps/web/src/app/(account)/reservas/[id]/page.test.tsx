import type { Booking } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  loadPublicVenue: vi.fn(),
  demo: false,
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/public-venue', () => ({
  loadPublicVenue: mocks.loadPublicVenue,
}));
vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return mocks.demo;
    },
    get demoSquad() {
      return mocks.demo ? fixtures.DEMO_SQUAD : [];
    },
  };
});
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('@/components/booking/pix-payment', () => ({
  PixPayment: (props: {
    bookingId: string;
    holdExpiresAt: string;
    serverNow?: string;
    totalCents: number;
  }) => (
    <div
      data-testid="pix"
      data-hold={props.holdExpiresAt}
      data-now={props.serverNow}
      data-total={props.totalCents}
    />
  ),
}));
vi.mock('@/components/booking/cancel-booking', () => ({
  CancelBooking: (props: { status?: string }) => (
    <button type="button" data-status={props.status}>
      Cancelar reserva
    </button>
  ),
}));

import BookingPage from './page';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

function make(patch: Partial<Booking> = {}): Booking {
  return {
    id: ID,
    status: 'held',
    startsAt: '2026-11-02T21:00:00.000Z',
    endsAt: '2026-11-02T22:30:00.000Z',
    totalCents: 15000,
    holdExpiresAt: '2026-11-02T12:10:00.000Z',
    venue: {
      slug: 'arena',
      name: 'Arena Vila',
      neighborhood: 'Vila Madalena',
      city: 'São Paulo',
      timezone: 'America/Sao_Paulo',
    },
    field: { id: ID, name: 'Society 1' },
    address: null,
    ...patch,
  };
}

const VENUE = {
  photos: [
    { id: ID, url: '/foto.jpg', srcSet: '/foto-480.jpg 480w', position: 0 },
  ],
  fields: [{ id: ID, basePriceCentsPerHour: 8000 }],
};

async function renderPage(
  booking: Booking,
  query: Record<string, string | string[]> = {},
  id = ID,
) {
  mocks.apiGet.mockResolvedValue(booking);
  render(
    await BookingPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(query),
    }),
  );
}

const CONFIRMED = {
  status: 'confirmed',
  holdExpiresAt: null,
  address: {
    street: 'Rua Harmonia',
    number: '123',
    complement: 'Fundos',
    cep: '05435000',
    phone: '+5511987654321',
  },
} as const;

describe('/reservas/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demo = false;
    mocks.loadPublicVenue.mockResolvedValue(VENUE);
    // Fixed "now" before the booking, so "already started" never depends on
    // the real date.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the booking with the session and 404s on a malformed id', async () => {
    await expect(
      BookingPage({
        params: Promise.resolve({ id: 'abc' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.apiGet).not.toHaveBeenCalled();

    await renderPage(make());
    expect(mocks.apiGet).toHaveBeenCalledWith(
      `/bookings/${ID}`,
      expect.anything(),
      `/reservas/${ID}`,
    );
  });

  it('held: "Confirmar e pagar" with the space, day, time, court and real prices', async () => {
    await renderPage(make(), { jogadores: '14' });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Confirmar e pagar' }),
    ).toBeVisible();
    // Going back keeps the group size the person chose.
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/espacos/arena?jogadores=14',
    );
    expect(screen.getByText('Arena Vila')).toBeVisible();
    // 21:00Z is 18:00 on Monday 2 in São Paulo.
    expect(screen.getByText(/Seg, 2 nov/)).toBeVisible();
    expect(screen.getByText('18:00–19:30')).toBeVisible();
    expect(screen.getByText('Society 1 · 14 jogadores')).toBeVisible();
    expect(screen.getByText(/^1h30/)).toBeVisible();
    expect(screen.getByText('Total')).toBeVisible();
    expect(screen.getAllByText(/R\$\s150,00/)).toHaveLength(2);
    expect(screen.queryByText(/Taxa de serviço/)).toBeNull();
    expect(document.querySelector('img')).toHaveAttribute('src', '/foto.jpg');
  });

  it('held: free cancellation until 24h before, with the date and time', async () => {
    await renderPage(make());
    expect(
      screen.getByText(
        'Cancelamento grátis até 24h antes (dom, 1 nov, 18:00).',
      ),
    ).toBeVisible();
  });

  it('held: inside 24 hours the note says it cannot be cancelled after paying', async () => {
    vi.setSystemTime(new Date('2026-11-02T00:00:00.000Z'));
    await renderPage(make());
    expect(screen.getByText(/começa em menos de 24h/)).toBeVisible();
    expect(screen.queryByText(/grátis/)).toBeNull();
  });

  it('held: shows the payment (with the total) and keeps the address private', async () => {
    await renderPage(make());
    expect(screen.getByTestId('pix')).toHaveAttribute(
      'data-hold',
      '2026-11-02T12:10:00.000Z',
    );
    expect(screen.getByTestId('pix')).toHaveAttribute('data-total', '15000');
    expect(screen.queryByText('Quadra garantida.')).toBeNull();
    expect(screen.queryByText(/Como chegar/)).toBeNull();
  });

  it('held: players only where known (a valid ?jogadores)', async () => {
    await renderPage(make(), { jogadores: '99' });
    expect(screen.getByText('Society 1')).toBeVisible();
    expect(screen.queryByText(/jogadores/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/espacos/arena',
    );
  });

  it('held: marks a peak time when the hour costs more than the court base price', async () => {
    // 150,00 for 1h30 is 100,00 an hour; the base price is 80,00.
    await renderPage(make());
    expect(screen.getByText('1h30 · horário nobre')).toBeVisible();
  });

  it('held: no "nobre" at the base price', async () => {
    mocks.loadPublicVenue.mockResolvedValue({
      ...VENUE,
      fields: [{ id: ID, basePriceCentsPerHour: 10000 }],
    });
    await renderPage(make());
    expect(screen.getByText('1h30')).toBeVisible();
    expect(screen.queryByText(/nobre/)).toBeNull();
  });

  it('held: still renders when the venue cannot be loaded (no photo, no "nobre")', async () => {
    mocks.loadPublicVenue.mockRejectedValue(new Error('indisponível'));
    await renderPage(make());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Confirmar e pagar' }),
    ).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('1h30')).toBeVisible();
  });

  it('held: nothing of the team split outside the demo', async () => {
    await renderPage(make(), { jogadores: '14' });
    expect(screen.queryByText('Receber de volta do time')).toBeNull();
    expect(screen.queryByText('Racha do time')).toBeNull();
  });

  it('held, demo: offers "Receber de volta do time" when the players are known', async () => {
    mocks.demo = true;
    await renderPage(make(), { jogadores: '14' });
    expect(
      screen.getByRole('switch', { name: /Receber de volta do time/ }),
    ).toBeVisible();
  });

  it('held, demo: without the players there is no split to offer', async () => {
    mocks.demo = true;
    await renderPage(make());
    expect(screen.queryByText('Receber de volta do time')).toBeNull();
  });

  it('held: the player can give the booking up', async () => {
    await renderPage(make());

    expect(
      screen.getByRole('button', { name: 'Cancelar reserva' }),
    ).toHaveAttribute('data-status', 'held');
  });

  it('confirmed: quadra garantida with the full address, phone and cancel', async () => {
    await renderPage(make(CONFIRMED));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadra garantida.' }),
    ).toBeVisible();
    expect(screen.getByText(/Arena Vila · Seg, 2 nov ·/)).toBeVisible();
    expect(screen.getByText('18:00–19:30')).toBeVisible();
    expect(screen.getByText(/Rua Harmonia, 123 - Fundos/)).toBeVisible();
    expect(screen.getByText(/05435-000/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: '(11) 98765-4321' }),
    ).toHaveAttribute('href', 'tel:+5511987654321');
    expect(
      screen.getByRole('button', { name: 'Cancelar reserva' }),
    ).toHaveAttribute('data-status', 'confirmed');
    expect(
      screen.getByText(
        'Cancelamento grátis até 24h antes (dom, 1 nov, 18:00).',
      ),
    ).toBeVisible();
    expect(screen.queryByTestId('pix')).toBeNull();
    // Leaves through the home or the list of bookings.
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByRole('link', { name: 'Minhas reservas' }),
    ).toHaveAttribute('href', '/reservas');
    // Real facts of the booking; nothing fictional outside the demo.
    expect(screen.getByRole('list', { name: 'Sua reserva' })).toBeVisible();
    expect(screen.queryByText('Racha do time')).toBeNull();
  });

  it('confirmed, demo: "Racha do time" with the list and "x de 14 pagaram"', async () => {
    mocks.demo = true;
    await renderPage(make(CONFIRMED), { jogadores: '14' });
    expect(
      screen.getByRole('heading', { level: 2, name: 'Racha do time' }),
    ).toBeVisible();
    expect(screen.getByText('3 de 14 pagaram')).toBeVisible();
    expect(screen.getByText('Rafael L.')).toBeVisible();
  });

  it('confirmed, demo: no racha when the group size is not known', async () => {
    mocks.demo = true;
    await renderPage(make(CONFIRMED));
    expect(screen.queryByText('Racha do time')).toBeNull();
  });

  it('confirmed and already started: no cancellation', async () => {
    vi.setSystemTime(new Date('2026-11-02T21:30:00.000Z'));
    await renderPage(
      make({
        ...CONFIRMED,
        address: { ...CONFIRMED.address, complement: null },
      }),
    );
    expect(screen.getByText(/Rua Harmonia, 123/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Cancelar reserva' }),
    ).toBeNull();
  });

  it('hands the payment the server clock', async () => {
    await renderPage(make());
    expect(screen.getByTestId('pix').getAttribute('data-now')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });

  it.each([
    ['expired', 'Reserva expirada', 'O prazo para pagamento acabou'],
    ['cancelled', 'Reserva cancelada', 'Se havia um pagamento'],
  ] as const)(
    '%s: states it and offers another time',
    async (status, title, text) => {
      await renderPage(make({ status, holdExpiresAt: null }));
      expect(
        screen.getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(screen.getByText(new RegExp(text))).toBeVisible();
      expect(
        screen.getByRole('link', { name: 'Escolher outro horário' }),
      ).toHaveAttribute('href', '/espacos/arena');
      expect(screen.queryByTestId('pix')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Cancelar reserva' }),
      ).toBeNull();
    },
  );
});
