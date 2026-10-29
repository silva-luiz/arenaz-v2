import type { Booking } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  notFound: vi.fn((): never => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('@/components/booking/pix-payment', () => ({
  PixPayment: (props: { bookingId: string; holdExpiresAt: string }) => (
    <div data-testid="pix" data-hold={props.holdExpiresAt} />
  ),
}));
vi.mock('@/components/booking/cancel-booking', () => ({
  CancelBooking: () => <button type="button">Cancelar reserva</button>,
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

async function renderPage(booking: Booking, id = ID) {
  mocks.apiGet.mockResolvedValue(booking);
  render(await BookingPage({ params: Promise.resolve({ id }) }));
}

describe('/reservas/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the booking with the session and 404s on a malformed id', async () => {
    await expect(
      BookingPage({ params: Promise.resolve({ id: 'abc' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.apiGet).not.toHaveBeenCalled();

    await renderPage(make());
    expect(mocks.apiGet).toHaveBeenCalledWith(
      `/bookings/${ID}`,
      expect.anything(),
      `/reservas/${ID}`,
    );
  });

  it('held: reviews the booking in the venue time and shows the payment', async () => {
    await renderPage(make());
    expect(
      screen.getByRole('heading', { level: 1, name: 'Pague para garantir' }),
    ).toBeVisible();
    expect(screen.getByText('Arena Vila')).toBeVisible();
    expect(screen.getByText('Society 1')).toBeVisible();
    // 21:00Z is 18:00 in São Paulo.
    expect(screen.getByText('18:00–19:30')).toBeVisible();
    expect(screen.getByText(/R\$\s150/)).toBeVisible();
    expect(
      screen.getByText(/com pelo menos 24 horas de antecedência/),
    ).toBeVisible();
    expect(screen.getByTestId('pix')).toHaveAttribute(
      'data-hold',
      '2026-11-02T12:10:00.000Z',
    );
    expect(screen.queryByText('Quadra garantida')).toBeNull();
    // The exact address is not known before the payment.
    expect(screen.getByText('Vila Madalena, São Paulo')).toBeVisible();
  });

  it('confirmed: quadra garantida with the full address, phone and cancel', async () => {
    await renderPage(
      make({
        status: 'confirmed',
        holdExpiresAt: null,
        address: {
          street: 'Rua Harmonia',
          number: '123',
          complement: 'Fundos',
          cep: '05435000',
          phone: '+5511987654321',
        },
      }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadra garantida' }),
    ).toBeVisible();
    expect(screen.getByText(/Rua Harmonia, 123 - Fundos/)).toBeVisible();
    expect(screen.getByText(/05435-000/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: '(11) 98765-4321' }),
    ).toHaveAttribute('href', 'tel:+5511987654321');
    expect(
      screen.getByRole('button', { name: 'Cancelar reserva' }),
    ).toBeVisible();
    expect(screen.queryByTestId('pix')).toBeNull();
  });

  it.each([
    ['expired', 'O prazo para pagamento acabou'],
    ['cancelled', 'Se havia um pagamento'],
  ] as const)('%s: states it and offers another time', async (status, text) => {
    await renderPage(make({ status, holdExpiresAt: null }));
    expect(screen.getByText(new RegExp(text))).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Escolher outro horário' }),
    ).toHaveAttribute('href', '/espacos/arena');
    expect(screen.queryByTestId('pix')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Cancelar reserva' }),
    ).toBeNull();
  });
});
