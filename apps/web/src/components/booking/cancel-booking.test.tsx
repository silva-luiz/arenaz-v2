import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { CancelBooking } from './cancel-booking';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('CancelBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks before cancelling and can be dismissed', async () => {
    const user = userEvent.setup();
    render(<CancelBooking bookingId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    expect(
      screen.getByText(/com pelo menos 24 horas de antecedência/),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByRole('button', { name: 'Sim, cancelar' })).toBeNull();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('cancels and reloads the page', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<CancelBooking bookingId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      `/bookings/${ID}/cancel`,
      undefined,
      expect.anything(),
    );
  });

  it('shows the 409 of a cancellation under 24 hours', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 409,
      fieldErrors: {},
      message:
        'O cancelamento só é possível com pelo menos 24 horas de antecedência',
    });
    const user = userEvent.setup();
    render(<CancelBooking bookingId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O cancelamento só é possível com pelo menos 24 horas de antecedência',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
