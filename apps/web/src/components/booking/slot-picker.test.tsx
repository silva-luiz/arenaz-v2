import type { Availability } from '@arenaz/contracts';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchAvailability: vi.fn(),
  createBooking: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/booking-client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/booking-client')>()),
  fetchAvailability: mocks.fetchAvailability,
  createBooking: mocks.createBooking,
}));
vi.mock('@/lib/navigate', () => ({ navigate: mocks.navigate }));

import { SlotPicker } from './slot-picker';

const FIELD_1 = '11111111-1111-4111-8111-111111111111';
const FIELD_2 = '11111111-1111-4111-8111-111111111112';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';

const FIELDS = [
  { id: FIELD_1, name: 'Quadra 1', minSlotMinutes: 60 },
  { id: FIELD_2, name: 'Quadra 2', minSlotMinutes: 30 },
];

/** "18:00" on 2026-11-0X in Brasília time. */
function iso(date: string, hhmm: string, plusMinutes = 0): string {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  const total = hours * 60 + minutes + plusMinutes;
  const h = String(Math.floor(total / 60)).padStart(2, '0');
  const m = String(total % 60).padStart(2, '0');
  return `${date}T${h}:${m}:00.000-03:00`;
}

function slotsOf(
  date: string,
  block: number,
  busy: string[] = [],
  starts = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'],
) {
  return starts.map((start) => ({
    startsAt: iso(date, start),
    endsAt: iso(date, start, block),
    available: !busy.includes(start),
    priceCents: block * 300,
  }));
}

function availabilityFor(
  date: string,
  busy: { field1?: string[]; field2?: string[] } = {},
): Availability {
  return {
    date,
    timezone: 'America/Sao_Paulo',
    fields: [
      {
        id: FIELD_1,
        name: 'Quadra 1',
        minSlotMinutes: 60,
        slots: slotsOf(date, 60, busy.field1),
      },
      {
        id: FIELD_2,
        name: 'Quadra 2',
        minSlotMinutes: 30,
        slots: slotsOf(date, 30, busy.field2),
      },
    ],
  };
}

function serveAvailability(busy: Parameters<typeof availabilityFor>[1] = {}) {
  mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
    Promise.resolve({ ok: true, data: availabilityFor(date, busy) }),
  );
}

function renderPicker(
  props: Partial<React.ComponentProps<typeof SlotPicker>> = {},
) {
  return render(
    <SlotPicker
      slug="arena-x"
      timezone="America/Sao_Paulo"
      fields={FIELDS}
      signedIn={false}
      {...props}
    />,
  );
}

async function loaded() {
  await screen.findByRole('button', { name: '18:00' });
}

describe('SlotPicker', () => {
  beforeEach(() => {
    // Thursday, 2026-11-05, afternoon in Brasília.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T18:00:00.000Z'));
    serveAvailability();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows today and the next 13 days as chips, today selected', async () => {
    renderPicker();
    await loaded();

    const group = screen.getByRole('group', { name: 'Data' });
    const chips = within(group).getAllByRole('button');
    expect(chips).toHaveLength(14);
    expect(chips.slice(0, 4).map((chip) => chip.textContent)).toEqual([
      'Hoje',
      'Amanhã',
      'Sáb 7',
      'Dom 8',
    ]);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(chips[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('names each date chip with its full date', async () => {
    renderPicker();
    await loaded();

    const chips = within(
      screen.getByRole('group', { name: 'Data' }),
    ).getAllByRole('button');
    expect(chips[0]).toHaveAccessibleName('Hoje, quinta-feira, 5 de novembro');
    expect(chips[1]).toHaveAccessibleName('Amanhã, sexta-feira, 6 de novembro');
    expect(chips[2]).toHaveAccessibleName('Sáb 7, sábado, 7 de novembro');
  });

  it('leaves room above the chips for their focus ring', async () => {
    renderPicker();
    await loaded();

    expect(screen.getByRole('group', { name: 'Data' })).toHaveClass(
      'pt-1',
      '-mt-1',
    );
  });

  it('asks for the availability of the chosen day and shows its times', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    expect(mocks.fetchAvailability).toHaveBeenCalledWith(
      'arena-x',
      '2026-11-05',
      expect.anything(),
    );

    await user.click(screen.getByRole('button', { name: /^Amanhã/ }));

    await waitFor(() => {
      expect(mocks.fetchAvailability).toHaveBeenCalledWith(
        'arena-x',
        '2026-11-06',
        expect.anything(),
      );
    });
    expect(screen.getByRole('button', { name: /^Amanhã/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('lists the times of the first court and marks taken ones as unavailable', async () => {
    serveAvailability({ field1: ['19:00'] });
    renderPicker();
    await loaded();

    const times = screen.getByRole('group', { name: 'Horários' });
    expect(
      within(times)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']);
    expect(
      within(times).getByRole('button', { name: '19:00, indisponível' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '18:00' })).toBeEnabled();
  });

  it('switches the grid when another court is picked', async () => {
    serveAvailability({ field1: [], field2: ['18:30'] });
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.selectOptions(screen.getByLabelText('Quadra'), FIELD_2);

    expect(
      screen.getByRole('button', { name: '18:30, indisponível' }),
    ).toBeDisabled();
  });

  it('selects the minimum block and shows the range and the total', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(screen.getByRole('button', { name: '18:00' }));

    expect(screen.getByRole('button', { name: '18:00' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('Quadra 1');
    expect(summary).toHaveTextContent('Hoje');
    expect(summary).toHaveTextContent('18:00–19:00');
    // 60 min x 300 cents = R$ 180.
    expect(summary).toHaveTextContent('R$ 180');
  });

  it('extends over following times and adds their prices', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(screen.getByRole('button', { name: '18:00' }));
    await user.click(screen.getByRole('button', { name: '19:00' }));
    await user.click(screen.getByRole('button', { name: '20:00' }));

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('18:00–21:00');
    expect(summary).toHaveTextContent('R$ 540');
  });

  it('extends 30 by 30 on a court with a 30 minute block', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();
    await user.selectOptions(screen.getByLabelText('Quadra'), FIELD_2);

    await user.click(screen.getByRole('button', { name: '18:00' }));
    await user.click(screen.getByRole('button', { name: '18:30' }));
    await user.click(screen.getByRole('button', { name: '19:00' }));

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('18:00–19:30');
    expect(summary).toHaveTextContent('R$ 270');
  });

  it('does not select through a taken time and explains it', async () => {
    serveAvailability({ field1: ['20:00'] });
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(screen.getByRole('button', { name: '18:00' }));
    await user.click(screen.getByRole('button', { name: '21:00' }));

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('18:00–19:00');
    expect(
      screen.getByText(
        'Tem um horário ocupado no meio. Escolha horários seguidos.',
      ),
    ).toBeInTheDocument();
  });

  it('tells how to play longer', async () => {
    renderPicker();
    await loaded();

    expect(
      screen.getByText('Toque em horários seguidos para jogar mais tempo.'),
    ).toBeInTheDocument();
  });

  it('forgets the selection when the day changes', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();
    await user.click(screen.getByRole('button', { name: '18:00' }));

    await user.click(screen.getByRole('button', { name: /^Amanhã/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: 'Resumo da reserva' }),
      ).not.toHaveTextContent('18:00');
    });
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
  });

  it('says there is nothing free when every time is taken', async () => {
    serveAvailability({
      field1: ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'],
    });
    renderPicker();

    expect(
      await screen.findByText('Nenhum horário livre neste dia.'),
    ).toBeInTheDocument();
  });

  it('says so when the venue is closed that day', async () => {
    mocks.fetchAvailability.mockResolvedValue({
      ok: true,
      data: {
        date: '2026-11-05',
        timezone: 'America/Sao_Paulo',
        fields: [
          { id: FIELD_1, name: 'Quadra 1', minSlotMinutes: 60, slots: [] },
          { id: FIELD_2, name: 'Quadra 2', minSlotMinutes: 30, slots: [] },
        ],
      },
    });
    renderPicker();

    expect(
      await screen.findByText('O espaço não abre neste dia.'),
    ).toBeInTheDocument();
  });

  it('shows an error with a retry when the availability fails', async () => {
    mocks.fetchAvailability.mockResolvedValueOnce({
      ok: false,
      status: 0,
      fieldErrors: {},
      message: 'Não foi possível concluir. Tente novamente.',
    });
    const user = userEvent.setup();
    renderPicker();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os horários',
    );

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await loaded();
  });

  it('keeps the rate limit text when the availability is refused for too many requests', async () => {
    mocks.fetchAvailability.mockResolvedValueOnce({
      ok: false,
      status: 429,
      fieldErrors: {},
      message: 'Muitas tentativas. Aguarde um instante e tente de novo.',
    });
    renderPicker();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Aguarde um instante e tente de novo.',
    );
  });

  it('shows the venue time zone only when it is not Brasília time', async () => {
    const { unmount } = renderPicker();
    await loaded();
    expect(screen.queryByText(/^Horários de/)).not.toBeInTheDocument();
    unmount();

    mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
      Promise.resolve({
        ok: true,
        data: { ...availabilityFor(date), timezone: 'America/Manaus' },
      }),
    );
    renderPicker({ timezone: 'America/Manaus' });
    await loaded();

    expect(
      screen.getByText('Horários de Amazonas (UTC−4)'),
    ).toBeInTheDocument();
  });

  describe('Reservar', () => {
    it('sends an anonymous visitor to sign in and brings them back to the choice', async () => {
      const user = userEvent.setup();
      renderPicker({ signedIn: false });
      await loaded();
      await user.click(screen.getByRole('button', { name: '18:00' }));
      await user.click(screen.getByRole('button', { name: '19:00' }));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(mocks.createBooking).not.toHaveBeenCalled();
      expect(mocks.navigate).toHaveBeenCalledTimes(1);
      const target = String(mocks.navigate.mock.calls[0]?.[0]);
      expect(target.startsWith('/entrar?next=')).toBe(true);
      const next = new URL(target, 'http://x').searchParams.get('next') ?? '';
      const nextUrl = new URL(next, 'http://x');
      expect(nextUrl.pathname).toBe('/espacos/arena-x');
      expect(nextUrl.searchParams.get('data')).toBe('2026-11-05');
      expect(nextUrl.searchParams.get('quadra')).toBe(FIELD_1);
      expect(nextUrl.searchParams.get('inicio')).toBe(
        iso('2026-11-05', '18:00'),
      );
      expect(nextUrl.searchParams.get('duracao')).toBe('120');
    });

    it('keeps the choice in the sign in link when the session expired on the POST', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: false,
        status: 401,
        fieldErrors: {},
        message: 'Sua sessão expirou. Entre novamente.',
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '19:00' }));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalled();
      });
      const target = String(mocks.navigate.mock.lastCall?.[0]);
      const next = new URL(target, 'http://x').searchParams.get('next') ?? '';
      const nextUrl = new URL(next, 'http://x');
      expect(nextUrl.pathname).toBe('/espacos/arena-x');
      expect(nextUrl.searchParams.get('quadra')).toBe(FIELD_1);
      expect(nextUrl.searchParams.get('inicio')).toBe(
        iso('2026-11-05', '19:00'),
      );
    });

    it('can try again after coming back from the browser cache', async () => {
      mocks.createBooking.mockReturnValue(new Promise(() => undefined));
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '18:00' }));
      await user.click(screen.getByRole('button', { name: 'Reservar' }));
      expect(
        screen.getByRole('button', { name: /^Reservar, Aguarde/ }),
      ).toBeDisabled();

      act(() => {
        const event = new Event('pageshow');
        Object.defineProperty(event, 'persisted', { value: true });
        window.dispatchEvent(event);
      });

      expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled();
    });

    it('is disabled until a time is picked', async () => {
      renderPicker({ signedIn: true });
      await loaded();

      expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
    });

    it('creates the booking and goes to its page', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: BOOKING_ID },
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '19:00' }));
      await user.click(screen.getByRole('button', { name: '20:00' }));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(mocks.createBooking).toHaveBeenCalledWith({
        fieldId: FIELD_1,
        startsAt: iso('2026-11-05', '19:00'),
        durationMinutes: 120,
      });
      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(`/reservas/${BOOKING_ID}`);
      });
    });

    it('on 409 says the time was taken, reloads the grid and clears the choice', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: false,
        status: 409,
        fieldErrors: {},
        message: 'Esse horário acabou de ser reservado',
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '18:00' }));
      expect(mocks.fetchAvailability).toHaveBeenCalledTimes(1);

      // The reload now says 18:00 is gone.
      serveAvailability({ field1: ['18:00'] });
      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Esse horário acabou de ser reservado',
      );
      await waitFor(() => {
        expect(mocks.fetchAvailability).toHaveBeenCalledTimes(2);
      });
      expect(
        await screen.findByRole('button', { name: '18:00, indisponível' }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
      expect(mocks.navigate).not.toHaveBeenCalled();
    });

    it('shows other refusals without reloading', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: false,
        status: 422,
        fieldErrors: {},
        message: 'Você já tem reservas aguardando pagamento',
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '18:00' }));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Você já tem reservas aguardando pagamento',
      );
      expect(mocks.fetchAvailability).toHaveBeenCalledTimes(1);
      // The choice is kept so the person can try again.
      expect(screen.getByRole('button', { name: 'Reservar' })).toBeEnabled();
    });

    it('does not post twice while the request is on its way', async () => {
      let finish: (value: unknown) => void = () => undefined;
      mocks.createBooking.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(screen.getByRole('button', { name: '18:00' }));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));
      // Busy: the button is disabled and says so.
      const busy = screen.getByRole('button', { name: /^Reservar, Aguarde/ });
      expect(busy).toBeDisabled();
      await user.click(busy);

      expect(mocks.createBooking).toHaveBeenCalledTimes(1);
      finish({ ok: true, data: { id: BOOKING_ID } });
    });
  });

  describe('coming back from sign in', () => {
    it('restores the choice when it is still free', async () => {
      renderPicker({
        signedIn: true,
        initial: {
          date: '2026-11-06',
          fieldId: FIELD_1,
          startsAt: iso('2026-11-06', '19:00'),
          durationMinutes: 120,
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('status', { name: 'Resumo da reserva' }),
        ).toHaveTextContent('19:00–21:00');
      });
      expect(screen.getByRole('button', { name: /^Amanhã/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('forgets the saved choice once the person acts on the page', async () => {
      const user = userEvent.setup();
      renderPicker({
        signedIn: true,
        initial: {
          date: '2026-11-06',
          fieldId: FIELD_1,
          startsAt: iso('2026-11-06', '19:00'),
          durationMinutes: 120,
        },
      });
      await loaded();

      await user.click(
        screen.getByRole('button', { name: 'Sáb 7, sábado, 7 de novembro' }),
      );
      await loaded();
      await user.click(screen.getByRole('button', { name: /^Amanhã/ }));
      await loaded();

      expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
    });

    it('drops the choice when it is no longer free', async () => {
      serveAvailability({ field1: ['20:00'] });
      renderPicker({
        signedIn: true,
        initial: {
          date: '2026-11-06',
          fieldId: FIELD_1,
          startsAt: iso('2026-11-06', '19:00'),
          durationMinutes: 120,
        },
      });
      await loaded();

      expect(screen.getByRole('button', { name: 'Reservar' })).toBeDisabled();
    });
  });
});
