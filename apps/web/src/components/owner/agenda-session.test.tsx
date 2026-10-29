import type { OwnerAgenda } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), refresh: vi.fn() }));

// The real apiSend runs here; only the page navigation seam is replaced.
vi.mock('@/lib/navigate', () => ({ navigate: mocks.navigate }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
}));

import { AgendaView } from './agenda-view';

const FIELD = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';
const BOOKING = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

const AGENDA: OwnerAgenda = {
  date: '2026-11-02',
  timezone: 'America/Sao_Paulo',
  fields: [
    {
      id: FIELD,
      name: 'Quadra 1',
      isActive: true,
      items: [
        {
          kind: 'booking',
          id: BOOKING,
          startsAt: '2026-11-02T21:00:00.000Z',
          endsAt: '2026-11-02T23:00:00.000Z',
          status: 'confirmed',
          origin: 'app',
          customerName: 'Ana S.',
          customerPhone: null,
          totalCents: 36000,
        },
      ],
    },
  ],
};

describe('AgendaView with an expired session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the owner to sign in when a cancel gets 401', async () => {
    const user = userEvent.setup();
    render(
      <AgendaView
        date={AGENDA.date}
        today="2026-11-02"
        timezone={AGENDA.timezone}
        fields={AGENDA.fields}
        hours={[{ weekday: 1, openMinute: 17 * 60, closeMinute: 23 * 60 }]}
      />,
    );

    await user.click(
      document.querySelector<HTMLElement>(
        '[data-agenda="grid"] button[aria-label^="Quadra 1"]',
      ) as HTMLElement,
    );
    const dialog = screen.getByRole('dialog', { name: 'Reserva' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Cancelar reserva' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Sim, cancelar' }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/entrar\?next=\//),
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Sua sessão expirou. Entre novamente.',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
