import type { Booking } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));

import BookingsPage from './page';

function make(
  id: string,
  status: Booking['status'],
  startsAt: string,
  endsAt: string,
  name = 'Arena Vila',
): Booking {
  return {
    id,
    status,
    startsAt,
    endsAt,
    totalCents: 15000,
    holdExpiresAt: null,
    venue: {
      slug: 'arena',
      name,
      neighborhood: 'Vila Madalena',
      city: 'São Paulo',
      timezone: 'America/Sao_Paulo',
    },
    field: { id: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10', name: 'Society 1' },
    address: null,
  };
}

describe('/reservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists upcoming and past bookings with a status badge each', async () => {
    mocks.apiGet.mockResolvedValue([
      make(
        '11111111-1111-4111-8111-111111111111',
        'confirmed',
        '2026-11-03T21:00:00.000Z',
        '2026-11-03T22:00:00.000Z',
        'Arena Futura',
      ),
      make(
        '22222222-2222-4222-8222-222222222222',
        'cancelled',
        '2026-10-20T21:00:00.000Z',
        '2026-10-20T22:00:00.000Z',
        'Arena Passada',
      ),
    ]);
    render(await BookingsPage());

    expect(mocks.apiGet).toHaveBeenCalledWith(
      '/bookings/me',
      expect.anything(),
      '/reservas',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Minhas reservas' }),
    ).toBeVisible();

    const upcoming = screen.getByRole('region', { name: 'Próximas' });
    const future = within(upcoming).getByRole('link', {
      name: /Arena Futura/,
    });
    expect(future).toHaveAttribute(
      'href',
      '/reservas/11111111-1111-4111-8111-111111111111',
    );
    expect(within(upcoming).getByText('Confirmada')).toBeVisible();
    expect(within(upcoming).getByText(/18:00 às 19:00/)).toBeVisible();

    const past = screen.getByRole('region', { name: 'Anteriores' });
    expect(within(past).getByText('Arena Passada')).toBeVisible();
    expect(within(past).getByText('Cancelada')).toBeVisible();
  });

  it('invites to search when there is nothing', async () => {
    mocks.apiGet.mockResolvedValue([]);
    render(await BookingsPage());
    expect(screen.getByText('Você ainda não tem reservas.')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Buscar quadras' }),
    ).toHaveAttribute('href', '/buscar');
  });
});
