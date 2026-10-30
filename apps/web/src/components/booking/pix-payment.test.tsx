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
      totalCents={46200}
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
    // An <img>, not markup: the only inline <svg> are the button's icons.
    expect(qr.tagName).toBe('IMG');
    expect(container.querySelector('svg:not([aria-hidden="true"])')).toBeNull();
    expect(qr).toHaveAttribute('width', '220');
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      `/bookings/${ID}/payment`,
      undefined,
      expect.anything(),
    );
  });

  it('is the prototype Pix step: title, countdown, amount and waiting line', async () => {
    mockCharge();
    renderPix();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pague com Pix' }),
    ).toBeVisible();
    expect(screen.getByText('Seu horário está reservado por')).toBeVisible();
    await screen.findByRole('img', { name: /QR code do Pix/ });
    expect(screen.getByText(/R\$\s462,00/)).toBeVisible();
    expect(screen.getByText('Aguardando pagamento…')).toBeVisible();
  });

  it('keeps the copy and paste code one tap away, closed by default', async () => {
    mockCharge();
    const user = userEvent.setup();
    renderPix();
    await screen.findByRole('img', { name: /QR code do Pix/ });
    expect(screen.getByText('ARENAZ-FAKE-1')).not.toBeVisible();
    await user.click(screen.getByText('Ver o código copia e cola'));
    expect(screen.getByText('ARENAZ-FAKE-1')).toBeVisible();
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
    // The button itself says it (prototype), and the status region speaks.
    expect(
      await screen.findByRole('button', { name: 'Código copiado' }),
    ).toBeVisible();
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent(
      'Código copiado',
    );
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
    // Failing to copy opens the code, so it can be selected by hand.
    expect(screen.getByText('ARENAZ-FAKE-1')).toBeVisible();
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
    // The server's state decides what the page is now.
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('says the session expired when the simulation is refused for lack of sign in', async () => {
    // apiSend already sent the browser to sign in; the page only says why.
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.endsWith('/payment')
          ? { ok: true, data: charge() }
          : {
              ok: false,
              status: 401,
              fieldErrors: {},
              message: 'Sua sessão expirou. Entre novamente.',
            },
      ),
    );
    const user = userEvent.setup();
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Simular pagamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sua sessão expirou. Entre novamente.',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Simular pagamento' }),
    ).toBeEnabled();
  });

  it('keeps the page when the simulation fails for another reason', async () => {
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.endsWith('/payment')
          ? { ok: true, data: charge() }
          : { ok: false, status: 500, fieldErrors: {}, message: 'Falhou' },
      ),
    );
    const user = userEvent.setup();
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Simular pagamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('a hold already past its deadline shows the expired view without refreshing', () => {
    mockCharge();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    const view = render(
      <PixPayment
        bookingId={ID}
        holdExpiresAt={holdExpiresAt}
        venueSlug="arena"
        totalCents={46200}
        serverNow={new Date(NOW.getTime() + 11 * 60_000).toISOString()}
      />,
    );
    expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Escolher outro horário' }),
    ).toBeVisible();
    // A refreshed page remounts it with a new server clock: still no loop.
    view.rerender(
      <PixPayment
        bookingId={ID}
        holdExpiresAt={holdExpiresAt}
        venueSlug="arena"
        totalCents={46200}
        serverNow={new Date(NOW.getTime() + 11 * 60_000 + 500).toISOString()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('does not reload the page when the charge fails with a 500', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 500,
      fieldErrors: {},
      message: 'Não foi possível concluir. Tente novamente.',
    });
    renderPix();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('reloads the page when "Simular pagamento" answers 404', async () => {
    mocks.apiSend.mockImplementation((_method: string, path: string) =>
      Promise.resolve(
        path.endsWith('/payment')
          ? { ok: true, data: charge() }
          : {
              ok: false,
              status: 404,
              fieldErrors: {},
              message: 'Cobrança não encontrada',
            },
      ),
    );
    const user = userEvent.setup();
    renderPix();
    await user.click(
      await screen.findByRole('button', { name: 'Simular pagamento' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cobrança não encontrada',
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it.each([404, 409])(
    'reloads the page when the charge answers %i',
    async (status) => {
      mocks.apiSend.mockResolvedValue({
        ok: false,
        status,
        fieldErrors: {},
        message: 'Essa reserva não está mais aguardando pagamento',
      });
      renderPix();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'não está mais aguardando',
      );
      await waitFor(() => {
        expect(mocks.refresh).toHaveBeenCalled();
      });
    },
  );

  it('announces a repeated copy again (clears, then sets)', async () => {
    mockCharge();
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderPix();
    const button = await screen.findByRole('button', {
      name: 'Copiar código',
    });
    await user.click(button);
    release();
    const status = () => screen.getAllByRole('status').at(-1);
    await waitFor(() => {
      expect(status()).toHaveTextContent('Código copiado');
    });
    await user.click(screen.getByRole('button', { name: 'Código copiado' }));
    expect(status()).toBeEmptyDOMElement();
    release();
    await waitFor(() => {
      expect(status()).toHaveTextContent('Código copiado');
    });
  });

  describe('clock skew', () => {
    function renderWith(serverNow: string | undefined) {
      return render(
        <PixPayment
          bookingId={ID}
          holdExpiresAt={holdExpiresAt}
          venueSlug="arena"
          totalCents={46200}
          serverNow={serverNow}
        />,
      );
    }

    it('a device clock ahead of the server does not expire the hold early', async () => {
      mockCharge();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      // The device says 12:05, the server 12:00: 10 minutes are left.
      vi.setSystemTime(new Date(NOW.getTime() + 5 * 60_000));
      renderWith(NOW.toISOString());
      await screen.findByRole('button', { name: 'Copiar código' });
      act(() => {
        vi.advanceTimersByTime(6 * 60_000);
      });
      expect(screen.queryByText('O prazo para pagamento acabou')).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Copiar código' }),
      ).toBeVisible();
      expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('a device clock behind the server does not expire the hold late', async () => {
      mockCharge();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(NOW.getTime() - 5 * 60_000));
      renderWith(NOW.toISOString());
      await screen.findByRole('button', { name: 'Copiar código' });
      act(() => {
        vi.advanceTimersByTime(10 * 60_000 + 1000);
      });
      expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
    });

    it('goes back to payable when the refreshed page still says held', async () => {
      mockCharge();
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(NOW);
      // No server clock yet: the local one gives up at 12:10.
      const view = renderWith(undefined);
      await screen.findByRole('button', { name: 'Copiar código' });
      act(() => {
        vi.advanceTimersByTime(10 * 60_000 + 1000);
      });
      expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Copiar código' }),
      ).toBeNull();
      expect(mocks.refresh).toHaveBeenCalled();

      // The refreshed page: same hold, and the server says it is 12:08.
      view.rerender(
        <PixPayment
          bookingId={ID}
          holdExpiresAt={holdExpiresAt}
          venueSlug="arena"
          totalCents={46200}
          serverNow={new Date(NOW.getTime() + 8 * 60_000).toISOString()}
        />,
      );
      expect(screen.queryByText('O prazo para pagamento acabou')).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Copiar código' }),
      ).toBeVisible();
      expect(screen.getByText('02:00')).toBeVisible();
    });
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
