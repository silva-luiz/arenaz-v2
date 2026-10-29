import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import { PixPayment } from './pix-payment';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const NOW = new Date('2026-11-02T12:00:00.000Z');
const holdExpiresAt = new Date(NOW.getTime() + 10 * 60_000).toISOString();

function charge(patch: Record<string, unknown> = {}) {
  return {
    chargeId: 'fake_abc',
    method: 'pix',
    qrCodeSvg: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
    copyPaste: 'ARENAZ-FAKE-1',
    expiresAt: holdExpiresAt,
    simulatable: true,
    ...patch,
  };
}

function mockCharge(patch: Record<string, unknown> = {}) {
  mocks.apiSend.mockImplementation((_method: string, path: string) => {
    if (path === `/bookings/${ID}/payment`) {
      return Promise.resolve({ ok: true, data: charge(patch) });
    }
    return Promise.resolve({ ok: true, data: { status: 'confirmed' } });
  });
}

function renderPix() {
  return render(
    <PixPayment
      bookingId={ID}
      holdExpiresAt={holdExpiresAt}
      venueSlug="arena"
    />,
  );
}

describe('PixPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the charge and shows the QR as an image, not as markup', async () => {
    mockCharge();
    const { container } = renderPix();
    const qr = await screen.findByRole('img', { name: /QR code do Pix/ });
    expect(qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('ARENAZ-FAKE-1')).toBeVisible();
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      `/bookings/${ID}/payment`,
      undefined,
      expect.anything(),
    );
  });

  it('copies the code with the clipboard and announces it', async () => {
    mockCharge();
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Copiar código' }),
    );
    expect(writeText).toHaveBeenCalledWith('ARENAZ-FAKE-1');
    expect(await screen.findByText('Código copiado')).toBeVisible();
  });

  it('says so when the code could not be copied', async () => {
    mockCharge();
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
      new Error('denied'),
    );
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Copiar código' }),
    );
    expect(await screen.findByText(/Não foi possível copiar/)).toBeVisible();
  });

  it('has no "Simular pagamento" when the charge is not simulatable', async () => {
    mockCharge({ simulatable: false });
    renderPix();
    await screen.findByRole('button', { name: 'Copiar código' });
    expect(
      screen.queryByRole('button', { name: 'Simular pagamento' }),
    ).toBeNull();
  });

  it('simulates the payment and reloads the page', async () => {
    mockCharge();
    const user = userEvent.setup();
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Simular pagamento' }),
    );
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      '/payments/fake/fake_abc/pay',
      undefined,
      expect.anything(),
    );
  });

  it('shows the error of a failed payment simulation', async () => {
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.endsWith('/payment')
          ? { ok: true, data: charge() }
          : {
              ok: false,
              status: 409,
              fieldErrors: {},
              message: 'O prazo para pagamento acabou',
            },
      ),
    );
    const user = userEvent.setup();
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Simular pagamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O prazo para pagamento acabou',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('offers a retry when the charge fails', async () => {
    mocks.apiSend.mockResolvedValueOnce({
      ok: false,
      status: 500,
      fieldErrors: {},
      message: 'Não foi possível concluir. Tente novamente.',
    });
    mocks.apiSend.mockResolvedValueOnce({ ok: true, data: charge() });
    const user = userEvent.setup();
    renderPix();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(
      await screen.findByRole('button', { name: 'Copiar código' }),
    ).toBeVisible();
  });

  it('expires: says the deadline is over and offers another time', async () => {
    mockCharge();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    renderPix();
    await screen.findByRole('button', { name: 'Copiar código' });
    act(() => {
      vi.advanceTimersByTime(10 * 60_000 + 1000);
    });
    expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Escolher outro horário' }),
    ).toHaveAttribute('href', '/espacos/arena');
    expect(screen.queryByRole('button', { name: 'Copiar código' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Simular pagamento' }),
    ).toBeNull();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
