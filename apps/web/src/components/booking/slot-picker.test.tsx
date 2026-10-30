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
vi.mock('@/lib/demo', () => ({ isDemoMode: false }));

import { BookingCard } from '@/components/public/booking-card';
import { BookingProvider, type BookingProviderProps } from './booking-state';
import { SlotPicker } from './slot-picker';

const FIELD_1 = '11111111-1111-4111-8111-111111111111';
const FIELD_2 = '11111111-1111-4111-8111-111111111112';
const BOOKING_ID = '33333333-3333-4333-8333-333333333333';

const FIELDS = [
  {
    id: FIELD_1,
    name: 'Quadra 1',
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
  },
  {
    id: FIELD_2,
    name: 'Quadra 2',
    minSlotMinutes: 30,
    basePriceCentsPerHour: 18000,
  },
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
  peak: string[] = [],
) {
  return starts.map((start) => ({
    startsAt: iso(date, start),
    endsAt: iso(date, start, block),
    available: !busy.includes(start),
    // R$ 180 an hour; R$ 220 an hour on the peak times.
    priceCents: peak.includes(start) ? (block / 30) * 11000 : block * 300,
  }));
}

function availabilityFor(
  date: string,
  busy: { field1?: string[]; field2?: string[]; peak?: string[] } = {},
): Availability {
  return {
    date,
    timezone: 'America/Sao_Paulo',
    fields: [
      {
        id: FIELD_1,
        name: 'Quadra 1',
        minSlotMinutes: 60,
        slots: slotsOf(date, 60, busy.field1, undefined, busy.peak),
      },
      {
        id: FIELD_2,
        name: 'Quadra 2',
        minSlotMinutes: 30,
        slots: slotsOf(date, 30, busy.field2, undefined, busy.peak),
      },
    ],
  };
}

function serveAvailability(busy: Parameters<typeof availabilityFor>[1] = {}) {
  mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
    Promise.resolve({ ok: true, data: availabilityFor(date, busy) }),
  );
}

function stubDesktop() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** The picker as the page shows it: with the booking card beside it. */
function renderPicker(
  props: Partial<Omit<BookingProviderProps, 'children'>> = {},
) {
  return render(
    <BookingProvider
      slug="arena-x"
      timezone="America/Sao_Paulo"
      fields={FIELDS}
      signedIn={false}
      {...props}
    >
      <SlotPicker />
      <BookingCard price={{ cents: 18000, from: false, offPeak: false }} />
    </BookingProvider>,
  );
}

/** The time button starting at `time` ("18:00"); its name says more. */
function slot(time: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${time}, `) });
}

async function loaded() {
  await screen.findByRole('button', { name: /^18:00, / });
}

/** The alerts on the screen (the picker's and the card's), as one text. */
function alerts(): string {
  return screen
    .getAllByRole('alert')
    .map((alert) => alert.textContent)
    .join(' | ');
}

describe('SlotPicker', () => {
  beforeEach(() => {
    // Thursday, 2026-11-05, afternoon in Brasília.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T18:00:00.000Z'));
    serveAvailability();
    stubDesktop();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows today and the next 13 days as weekday and number, today selected', async () => {
    renderPicker();
    await loaded();

    const group = screen.getByRole('group', { name: 'Data' });
    const days = within(group).getAllByRole('button');
    expect(days).toHaveLength(14);
    expect(days.slice(0, 4).map((day) => day.textContent)).toEqual([
      'Hoje5',
      'Sex6',
      'Sáb7',
      'Dom8',
    ]);
    expect(days[0]).toHaveAttribute('aria-pressed', 'true');
    expect(days[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws each day as the 64 x 68 px button of the prototype', async () => {
    renderPicker();
    await loaded();

    const day = within(
      screen.getByRole('group', { name: 'Data' }),
    ).getAllByRole('button')[0];
    expect(day).toHaveClass('w-16', 'h-[68px]', 'shrink-0');
  });

  it('names each day with its visible text first and the full date after', async () => {
    renderPicker();
    await loaded();

    const days = within(
      screen.getByRole('group', { name: 'Data' }),
    ).getAllByRole('button');
    expect(days[0]).toHaveAccessibleName('Hoje 5, quinta-feira, 5 de novembro');
    expect(days[1]).toHaveAccessibleName('Sex 6, sexta-feira, 6 de novembro');
    expect(days[2]).toHaveAccessibleName('Sáb 7, sábado, 7 de novembro');
  });

  it('leaves room around the days for their focus ring', async () => {
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

    await user.click(screen.getByRole('button', { name: /^Sex 6,/ }));

    await waitFor(() => {
      expect(mocks.fetchAvailability).toHaveBeenCalledWith(
        'arena-x',
        '2026-11-06',
        expect.anything(),
      );
    });
    expect(screen.getByRole('button', { name: /^Sex 6,/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('lists the times of the first court with their price, taken ones crossed out', async () => {
    serveAvailability({ field1: ['19:00'] });
    renderPicker();
    await loaded();

    const times = screen.getByRole('group', { name: 'Horários' });
    expect(
      within(times)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      '18:00R$ 180',
      '18:30R$ 180',
      '19:00Ocupado',
      '19:30R$ 180',
      '20:00R$ 180',
      '20:30R$ 180',
      '21:00R$ 180',
    ]);
    const taken = within(times).getByRole('button', {
      name: '19:00, ocupado, R$ 180',
    });
    expect(taken).toBeDisabled();
    expect(taken).toHaveClass('line-through');
    expect(slot('18:00')).toBeEnabled();
  });

  it('leaves out the times that already started today', async () => {
    // 15:00 in Brasília: 14:00 and 14:30 are gone, not "Ocupado".
    mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
      Promise.resolve({
        ok: true,
        data: {
          ...availabilityFor(date),
          fields: availabilityFor(date).fields.map((field) => ({
            ...field,
            slots: [
              ...slotsOf(
                date,
                field.minSlotMinutes,
                ['14:00', '14:30'],
                ['14:00', '14:30'],
              ),
              ...field.slots,
            ],
          })),
        },
      }),
    );
    renderPicker();
    await loaded();

    expect(screen.queryByRole('button', { name: /^14:00, / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^14:30, / })).toBeNull();
    expect(slot('18:00')).toBeEnabled();
  });

  it('names every time with its price and whether it is free, taken or chosen', async () => {
    serveAvailability({ field1: ['19:00'] });
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    expect(slot('18:00')).toHaveAccessibleName('18:00, R$ 180, livre');
    expect(slot('19:00')).toHaveAccessibleName('19:00, ocupado, R$ 180');

    await user.click(slot('18:00'));

    expect(slot('18:00')).toHaveAccessibleName('18:00, R$ 180, selecionado');
    expect(slot('18:00')).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the times dearer than the base price as "nobre"', async () => {
    serveAvailability({ peak: ['20:00', '21:00'] });
    renderPicker();
    await loaded();

    expect(slot('20:00')).toHaveTextContent('R$ 220 · nobre');
    expect(slot('20:00')).toHaveAccessibleName('20:00, R$ 220, nobre, livre');
    expect(within(slot('20:00')).getByText('R$ 220 · nobre')).toHaveClass(
      'text-peak',
    );
    expect(slot('18:00')).toHaveTextContent(/^18:00R\$ 180$/);
  });

  it('reaches every free time with the keyboard', async () => {
    serveAvailability({ field1: ['19:00'] });
    renderPicker();
    await loaded();

    const times = within(
      screen.getByRole('group', { name: 'Horários' }),
    ).getAllByRole('button');
    for (const button of times) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).not.toHaveAttribute('tabindex');
    }
    expect(
      times.filter((button) => !button.hasAttribute('disabled')),
    ).toHaveLength(6);
  });

  it('switches the grid when another court is picked', async () => {
    serveAvailability({ field1: [], field2: ['18:30'] });
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.selectOptions(screen.getByLabelText('Quadra'), FIELD_2);

    expect(
      screen.getByRole('button', { name: '18:30, ocupado, R$ 90' }),
    ).toBeDisabled();
  });

  it('selects the minimum block and shows the range and the total', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(slot('18:00'));

    expect(slot('18:00')).toHaveAttribute('aria-pressed', 'true');
    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('Quadra 1');
    expect(summary).toHaveTextContent('Qui, 5 nov');
    expect(summary).toHaveTextContent('18:00–19:00');
    // 60 min x 300 cents = R$ 180.
    expect(summary).toHaveTextContent('R$ 180');
  });

  it('extends over following times and adds their prices', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(slot('18:00'));
    await user.click(slot('19:00'));
    await user.click(slot('20:00'));

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('18:00–21:00');
    expect(summary).toHaveTextContent('R$ 540');
  });

  it('extends 30 by 30 on a court with a 30 minute block', async () => {
    const user = userEvent.setup();
    renderPicker();
    await loaded();
    await user.selectOptions(screen.getByLabelText('Quadra'), FIELD_2);

    await user.click(slot('18:00'));
    await user.click(slot('18:30'));
    await user.click(slot('19:00'));

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toHaveTextContent('18:00–19:30');
    expect(summary).toHaveTextContent('R$ 270');
  });

  it('does not select through a taken time and explains it', async () => {
    serveAvailability({ field1: ['20:00'] });
    const user = userEvent.setup();
    renderPicker();
    await loaded();

    await user.click(slot('18:00'));
    await user.click(slot('21:00'));

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
    await user.click(slot('18:00'));

    await user.click(screen.getByRole('button', { name: /^Sex 6,/ }));

    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: 'Resumo da reserva' }),
      ).not.toHaveTextContent('18:00');
    });
    expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
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

  it('says there is nothing left today once every start has passed', async () => {
    // 15:00 in Brasília; the venue closed at 15:00 today.
    mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
      Promise.resolve({
        ok: true,
        data: {
          ...availabilityFor(date),
          fields: availabilityFor(date).fields.map((field) => ({
            ...field,
            slots: slotsOf(date, 30, ['13:00', '14:00'], ['13:00', '14:00']),
          })),
        },
      }),
    );
    renderPicker();

    expect(
      await screen.findByText('Não há mais horários hoje.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('O espaço não abre neste dia.')).toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Horários' })).queryAllByRole(
        'button',
      ),
    ).toHaveLength(0);
  });

  it('lays the times out like the prototype at every width', async () => {
    renderPicker();
    await loaded();

    const grid = slot('18:00').parentElement;
    expect(grid).toHaveClass('grid-cols-[repeat(auto-fill,minmax(112px,1fr))]');
    expect(grid?.className).not.toMatch(/grid-cols-3/);
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

    await waitFor(() => {
      expect(alerts()).toContain('Não foi possível carregar os horários');
    });

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

    await waitFor(() => {
      expect(alerts()).toContain(
        'Muitas tentativas. Aguarde um instante e tente de novo.',
      );
    });
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
      await user.click(slot('18:00'));
      await user.click(slot('19:00'));

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
      await user.click(slot('19:00'));

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
      await user.click(slot('18:00'));
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

    it('is "Escolher horário" until a time is picked', async () => {
      renderPicker({ signedIn: true });
      await loaded();

      expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Escolher horário' }),
      ).toBeEnabled();
    });

    it('"Escolher horário" takes the focus to the chosen day', async () => {
      const user = userEvent.setup();
      Element.prototype.scrollIntoView = vi.fn();
      renderPicker({ signedIn: true });
      await loaded();

      await user.click(
        screen.getByRole('button', { name: 'Escolher horário' }),
      );

      expect(screen.getByRole('button', { name: /^Hoje 5,/ })).toHaveFocus();
    });

    it('keeps the group size in the sign in link', async () => {
      const user = userEvent.setup();
      renderPicker({ signedIn: false, initialPlayers: 12 });
      await loaded();
      await user.click(slot('18:00'));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      const target = String(mocks.navigate.mock.calls[0]?.[0]);
      const next = new URL(target, 'http://x').searchParams.get('next') ?? '';
      expect(new URL(next, 'http://x').searchParams.get('jogadores')).toBe(
        '12',
      );
    });

    it('creates the booking and goes to its page', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: BOOKING_ID },
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });
      await loaded();
      await user.click(slot('19:00'));
      await user.click(slot('20:00'));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(mocks.createBooking).toHaveBeenCalledWith({
        fieldId: FIELD_1,
        startsAt: iso('2026-11-05', '19:00'),
        durationMinutes: 120,
      });
      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          `/reservas/${BOOKING_ID}?jogadores=14`,
        );
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
      await user.click(slot('18:00'));
      expect(mocks.fetchAvailability).toHaveBeenCalledTimes(1);

      // The reload now says 18:00 is gone.
      serveAvailability({ field1: ['18:00'] });
      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      await waitFor(() => {
        expect(alerts()).toContain('Esse horário acabou de ser reservado');
      });
      await waitFor(() => {
        expect(mocks.fetchAvailability).toHaveBeenCalledTimes(2);
      });
      expect(
        await screen.findByRole('button', { name: '18:00, ocupado, R$ 180' }),
      ).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
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
      await user.click(slot('18:00'));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      await waitFor(() => {
        expect(alerts()).toContain('Você já tem reservas aguardando pagamento');
      });
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
      await user.click(slot('18:00'));

      await user.click(screen.getByRole('button', { name: 'Reservar' }));
      // Busy: the button is disabled and says so.
      const busy = screen.getByRole('button', { name: /^Reservar, Aguarde/ });
      expect(busy).toBeDisabled();
      await user.click(busy);

      expect(mocks.createBooking).toHaveBeenCalledTimes(1);
      finish({ ok: true, data: { id: BOOKING_ID } });
    });
  });

  describe('past midnight', () => {
    const TODAY = '2026-11-05';
    const TOMORROW = '2026-11-06';
    const AFTER = '2026-11-07';

    type Start = [string, number];

    /** Hourly slots; the hour may be 24 (00:00 of the next day). */
    function hourly(starts: Start[], busy: string[] = []) {
      const at = (date: string, hour: number) =>
        hour === 24
          ? `${date === TODAY ? TOMORROW : AFTER}T00:00:00.000-03:00`
          : `${date}T${String(hour).padStart(2, '0')}:00:00.000-03:00`;
      return starts.map(([date, hour]) => ({
        startsAt: at(date, hour),
        endsAt: at(date, hour + 1),
        available: !busy.includes(at(date, hour)),
        priceCents: 6000,
      }));
    }

    function availabilityOf(date: string, slots: ReturnType<typeof hourly>) {
      return {
        ok: true,
        data: {
          date,
          timezone: 'America/Sao_Paulo',
          fields: [
            { id: FIELD_1, name: 'Quadra 1', minSlotMinutes: 60, slots },
            { id: FIELD_2, name: 'Quadra 2', minSlotMinutes: 30, slots: [] },
          ],
        },
      };
    }

    function serveNight(
      options: { today?: Start[]; tomorrow?: Start[]; busy?: string[] } = {},
    ) {
      const today = options.today ?? [
        [TODAY, 21],
        [TODAY, 22],
        [TODAY, 23],
      ];
      const tomorrow = options.tomorrow ?? [
        [TOMORROW, 0],
        [TOMORROW, 1],
        [TOMORROW, 2],
      ];
      mocks.fetchAvailability.mockImplementation(
        (_slug: string, date: string) =>
          Promise.resolve(
            availabilityOf(
              date,
              hourly(date === TODAY ? today : tomorrow, options.busy),
            ),
          ),
      );
    }

    it('late at night still offers the early hours after midnight', async () => {
      // 23:30 in Brasília: every time of today has started.
      vi.setSystemTime(new Date('2026-11-06T02:30:00.000Z'));
      serveNight({
        busy: [
          `${TODAY}T21:00:00.000-03:00`,
          `${TODAY}T22:00:00.000-03:00`,
          `${TODAY}T23:00:00.000-03:00`,
        ],
      });
      renderPicker();

      const group = await screen.findByRole('group', {
        name: 'Madrugada de sexta-feira, 6 de novembro',
      });
      expect(
        within(group).getByRole('button', {
          name: '00:00, sexta-feira, 6 de novembro, R$ 60, livre',
        }),
      ).toBeEnabled();
      expect(
        screen.getByText('Não há mais horários hoje.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('O espaço não abre neste dia.')).toBeNull();
      expect(screen.queryByRole('button', { name: /^23:00, / })).toBeNull();
    });

    it('loads the next day and offers its first hours under a heading with the date', async () => {
      serveNight();
      renderPicker();

      const group = await screen.findByRole('group', {
        name: 'Madrugada de sexta-feira, 6 de novembro',
      });
      expect(mocks.fetchAvailability).toHaveBeenCalledWith(
        'arena-x',
        TOMORROW,
        expect.anything(),
      );
      expect(
        within(group)
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['00:00R$ 60', '01:00R$ 60', '02:00R$ 60']);
      // Names carry the date, so "00:00" is not mistaken for tonight.
      expect(
        within(group).getByRole('button', {
          name: '00:00, sexta-feira, 6 de novembro, R$ 60, livre',
        }),
      ).toBeEnabled();
    });

    it('marks taken early hours as unavailable with the date in the name', async () => {
      serveNight({ busy: [`${TOMORROW}T01:00:00.000-03:00`] });
      renderPicker();

      expect(
        await screen.findByRole('button', {
          name: '01:00, sexta-feira, 6 de novembro, ocupado, R$ 60',
        }),
      ).toBeDisabled();
    });

    it('does not load or show the next day when the venue closes before midnight', async () => {
      serveNight({
        today: [
          [TODAY, 20],
          [TODAY, 21],
        ],
      });
      renderPicker();
      await screen.findByRole('button', { name: /^20:00, / });

      expect(mocks.fetchAvailability).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/^Madrugada de/)).not.toBeInTheDocument();
    });

    it('does not show the next day when it does not open at 00:00', async () => {
      serveNight({
        tomorrow: [
          [TOMORROW, 8],
          [TOMORROW, 9],
        ],
      });
      renderPicker();
      await screen.findByRole('button', { name: /^21:00, / });

      expect(mocks.fetchAvailability).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/^Madrugada de/)).not.toBeInTheDocument();
    });

    it('still shows the day when the next day fails to load', async () => {
      mocks.fetchAvailability.mockImplementation(
        (_slug: string, date: string) =>
          Promise.resolve(
            date === TODAY
              ? availabilityOf(date, hourly([[TODAY, 23]]))
              : {
                  ok: false,
                  status: 500,
                  fieldErrors: {},
                  message: 'Não foi possível concluir. Tente novamente.',
                },
          ),
      );
      renderPicker();

      expect(
        await screen.findByRole('button', { name: /^23:00, / }),
      ).toBeEnabled();
      expect(screen.queryByText(/^Madrugada de/)).not.toBeInTheDocument();
      for (const alert of screen.queryAllByRole('alert')) {
        expect(alert).toBeEmptyDOMElement();
      }
    });

    it('extends a selection across midnight and books it as one stretch', async () => {
      serveNight();
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: BOOKING_ID },
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });

      await user.click(await screen.findByRole('button', { name: /^23:00, / }));
      await user.click(
        screen.getByRole('button', {
          name: '00:00, sexta-feira, 6 de novembro, R$ 60, livre',
        }),
      );
      await user.click(
        screen.getByRole('button', {
          name: '01:00, sexta-feira, 6 de novembro, R$ 60, livre',
        }),
      );

      const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
      expect(summary).toHaveTextContent('23:00–02:00');
      expect(summary).toHaveTextContent('termina Sex, 6 nov');
      // Three hours at R$ 60.
      expect(summary).toHaveTextContent('R$ 180');

      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(mocks.createBooking).toHaveBeenCalledWith({
        fieldId: FIELD_1,
        startsAt: '2026-11-05T23:00:00.000-03:00',
        durationMinutes: 180,
      });
    });

    it('can start in the early hours', async () => {
      serveNight();
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: BOOKING_ID },
      });
      const user = userEvent.setup();
      renderPicker({ signedIn: true });

      await user.click(
        await screen.findByRole('button', {
          name: '01:00, sexta-feira, 6 de novembro, R$ 60, livre',
        }),
      );
      await user.click(screen.getByRole('button', { name: 'Reservar' }));

      expect(mocks.createBooking).toHaveBeenCalledWith({
        fieldId: FIELD_1,
        startsAt: '2026-11-06T01:00:00.000-03:00',
        durationMinutes: 60,
      });
    });

    it('restores a saved choice that crosses midnight', async () => {
      serveNight();
      renderPicker({
        signedIn: true,
        initial: {
          date: TODAY,
          fieldId: FIELD_1,
          startsAt: '2026-11-05T23:00:00.000-03:00',
          durationMinutes: 120,
        },
      });

      await waitFor(() => {
        expect(
          screen.getByRole('status', { name: 'Resumo da reserva' }),
        ).toHaveTextContent('23:00–01:00');
      });
    });
  });

  describe('arriving from the search', () => {
    it('opens the day of ?data', async () => {
      renderPicker({ initialDate: '2026-11-07' });

      await waitFor(() => {
        expect(mocks.fetchAvailability).toHaveBeenCalledWith(
          'arena-x',
          '2026-11-07',
          expect.anything(),
        );
      });
      expect(screen.getByRole('button', { name: /^Sáb 7,/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('offers days up to a ?data beyond the first two weeks', async () => {
      renderPicker({ initialDate: '2026-12-01' });

      expect(
        await screen.findByRole('button', { name: /^Ter 1,/ }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('ignores a ?data outside the bookable horizon', async () => {
      renderPicker({ initialDate: '2027-03-01' });
      await loaded();

      expect(screen.getByRole('button', { name: /^Hoje 5,/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(mocks.fetchAvailability).toHaveBeenCalledWith(
        'arena-x',
        '2026-11-05',
        expect.anything(),
      );
    });

    it('picks the ?hora of that day when it is free', async () => {
      renderPicker({ initialDate: '2026-11-06', initialTime: '19:00' });

      await waitFor(() => {
        expect(slot('19:00')).toHaveAttribute('aria-pressed', 'true');
      });
      expect(
        screen.getByRole('status', { name: 'Resumo da reserva' }),
      ).toHaveTextContent('19:00–20:00');
    });

    it('just opens the day when the ?hora is taken', async () => {
      serveAvailability({ field1: ['19:00'] });
      renderPicker({ initialDate: '2026-11-06', initialTime: '19:00' });
      await loaded();

      expect(screen.getByRole('button', { name: /^Sex 6,/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
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
      expect(screen.getByRole('button', { name: /^Sex 6,/ })).toHaveAttribute(
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
      await user.click(screen.getByRole('button', { name: /^Sex 6,/ }));
      await loaded();

      expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
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

      expect(screen.queryByRole('button', { name: 'Reservar' })).toBeNull();
    });
  });
});
