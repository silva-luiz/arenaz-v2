import type { Availability } from '@arenaz/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchAvailability: vi.fn(),
  createBooking: vi.fn(),
  navigate: vi.fn(),
  demo: false,
}));

vi.mock('@/lib/booking-client', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/booking-client')>()),
  fetchAvailability: mocks.fetchAvailability,
  createBooking: mocks.createBooking,
}));
vi.mock('@/lib/navigate', () => ({ navigate: mocks.navigate }));
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo;
  },
}));

import {
  BookingProvider,
  type BookingProviderProps,
} from '@/components/booking/booking-state';
import { SlotPicker } from '@/components/booking/slot-picker';
import {
  BookingCard,
  BookingPanel,
  type BookingCardProps,
} from './booking-card';

const FIELD_ID = '11111111-1111-4111-8111-111111111111';
const FIELDS = [
  {
    id: FIELD_ID,
    name: 'Quadra 1',
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
  },
];

/** 20:00 to 23:00 on 2026-11-05, R$ 180 then R$ 220 from 21:00. */
function availability(date: string): Availability {
  const at = (hour: number) =>
    `${date}T${String(hour).padStart(2, '0')}:00:00.000-03:00`;
  return {
    date,
    timezone: 'America/Sao_Paulo',
    fields: [
      {
        id: FIELD_ID,
        name: 'Quadra 1',
        minSlotMinutes: 60,
        slots: [20, 21, 22].map((hour) => ({
          startsAt: at(hour),
          endsAt: at(hour + 1),
          available: true,
          priceCents: hour === 20 ? 18000 : 22000,
        })),
      },
    ],
  };
}

function stubViewport(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: desktop && query.includes('min-width: 1024px'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const PRICE: BookingCardProps['price'] = {
  cents: 18000,
  from: false,
  offPeak: true,
};

function renderBooking(
  props: Partial<Omit<BookingProviderProps, 'children'>> = {},
  price: BookingCardProps['price'] = PRICE,
) {
  return render(
    <BookingProvider
      slug="arena-x"
      timezone="America/Sao_Paulo"
      fields={FIELDS}
      signedIn
      {...props}
    >
      <SlotPicker />
      <BookingPanel />
      <BookingCard price={price} />
    </BookingProvider>,
  );
}

async function loaded() {
  await screen.findByRole('button', { name: /^20:00, / });
}

function card() {
  return screen.getByRole('complementary', { name: 'Reserva' });
}

describe('BookingCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T18:00:00.000Z'));
    mocks.demo = false;
    mocks.fetchAvailability.mockImplementation((_slug: string, date: string) =>
      Promise.resolve({ ok: true, data: availability(date) }),
    );
    Element.prototype.scrollIntoView = vi.fn();
    stubViewport(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('from lg up', () => {
    it('shows the off-peak price of the prototype', async () => {
      renderBooking();
      await loaded();

      expect(card()).toHaveTextContent('R$ 180 / hora fora de pico');
    });

    it('says "a partir de" when the lowest price is not the usual one', async () => {
      renderBooking({}, { cents: 9000, from: true, offPeak: false });
      await loaded();

      expect(card()).toHaveTextContent('a partir de');
      expect(card()).toHaveTextContent('R$ 90 / hora');
      expect(card()).not.toHaveTextContent('fora de pico');
    });

    it('is a card in the right column, sticky under the header', () => {
      renderBooking();

      expect(card()).toHaveAttribute('data-booking-bar');
      expect(card().className).toContain('sticky');
      expect(card().className).toContain('lg:top-28');
      expect(card().className).toContain('lg:shadow-3');
    });

    it('tells when and asks for a time until one is picked', async () => {
      renderBooking();
      await loaded();

      const when = within(card()).getByRole('link', { name: /^Quando/ });
      expect(when).toHaveAttribute('href', '#horarios');
      expect(when).toHaveTextContent('Qui, 5 nov · escolha um horário');
      expect(
        within(card()).getByRole('button', { name: 'Escolher horário' }),
      ).toBeInTheDocument();
    });

    it('turns into "Reservar" with the range, the hours and the total, without any fee', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();

      await user.click(screen.getByRole('button', { name: /^20:00, / }));
      await user.click(screen.getByRole('button', { name: /^21:00, / }));

      expect(
        within(card()).getByRole('link', { name: /^Quando/ }),
      ).toHaveTextContent('Qui, 5 nov · 20:00–22:00');
      const summary = within(card()).getByRole('status', {
        name: 'Resumo da reserva',
      });
      expect(summary).toHaveTextContent('Confirmação na hora do pagamento');
      expect(summary).toHaveTextContent('2 horas');
      expect(summary).toHaveTextContent('TotalR$ 400,00');
      expect(summary).not.toHaveTextContent(/taxa/i);
      expect(
        within(card()).getByRole('button', { name: 'Reservar' }),
      ).toBeEnabled();
    });

    it('starts the group at 14 and steps it one by one', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();

      expect(card()).toHaveTextContent('14 pessoas');
      await user.click(
        within(card()).getByRole('button', { name: 'Mais um jogador' }),
      );
      expect(card()).toHaveTextContent('15 pessoas');
      await user.click(
        within(card()).getByRole('button', { name: 'Menos um jogador' }),
      );
      expect(card()).toHaveTextContent('14 pessoas');
    });

    it('never goes above 30', async () => {
      const user = userEvent.setup();
      renderBooking({ initialPlayers: 29 });
      await loaded();
      const more = within(card()).getByRole('button', {
        name: 'Mais um jogador',
      });

      await user.click(more);
      await user.click(more);

      expect(card()).toHaveTextContent('30 pessoas');
    });

    it('never goes below 2', async () => {
      const user = userEvent.setup();
      renderBooking({ initialPlayers: 3 });
      await loaded();
      const less = within(card()).getByRole('button', {
        name: 'Menos um jogador',
      });

      await user.click(less);
      await user.click(less);

      expect(card()).toHaveTextContent('2 pessoas');
    });

    it('starts the group at ?jogadores', async () => {
      renderBooking({ initialPlayers: 12 });
      await loaded();

      expect(card()).toHaveTextContent('12 pessoas');
    });

    it('divides the total by the group, rounded up to the cent', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^21:00, / }));
      await user.click(screen.getByRole('button', { name: /^22:00, / }));

      // R$ 440 / 14 = 31,428... -> R$ 31,43.
      const summary = within(card()).getByRole('status', {
        name: 'Resumo da reserva',
      });
      expect(summary).toHaveTextContent('Por pessoa (14)R$ 31,43');

      await user.click(
        within(card()).getByRole('button', { name: 'Menos um jogador' }),
      );
      expect(summary).toHaveTextContent('Por pessoa (13)R$ 33,85');
    });

    it('hides the share per person when the switch is off', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^20:00, / }));

      const toggle = within(card()).getByRole('switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(card()).not.toHaveTextContent('Por pessoa');
    });

    it('does not promise to charge each player outside the demo', async () => {
      renderBooking();
      await loaded();

      const toggle = within(card()).getByRole('switch');
      expect(toggle).toHaveAccessibleName('Mostrar valor por pessoa');
      expect(card()).not.toHaveTextContent('Dividir com o time');
      expect(card()).not.toHaveTextContent('Pix');
    });

    it('uses the prototype copy of "Dividir com o time" in the demo', async () => {
      mocks.demo = true;
      renderBooking();
      await loaded();

      const toggle = within(card()).getByRole('switch');
      expect(toggle).toHaveAccessibleName('Dividir com o time');
      expect(toggle).toHaveAccessibleDescription(
        'Cada um paga a sua parte no Pix',
      );
    });

    it('has no bar and no phone panel', async () => {
      renderBooking();
      await loaded();

      expect(
        screen.getAllByRole('status', { name: 'Resumo da reserva' }),
      ).toHaveLength(1);
      expect(screen.getAllByRole('switch')).toHaveLength(1);
    });
  });

  describe('on a phone', () => {
    beforeEach(() => {
      stubViewport(false);
    });

    it('is a bar that sticks above the tab bar', () => {
      renderBooking();

      expect(card()).toHaveAttribute('data-booking-bar');
      expect(card().className).toContain('sticky');
      expect(card().className).toContain(
        'bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))]',
      );
      expect(card().className).toContain('h-(--booking-bar-h)');
    });

    it('shows the price and "Escolher horário", which goes to the days', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();

      expect(card()).toHaveTextContent('R$ 180 / hora');
      await user.click(
        within(card()).getByRole('button', { name: 'Escolher horário' }),
      );

      expect(screen.getByRole('button', { name: /^Hoje 5,/ })).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the choice and books it from the bar', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: '33333333-3333-4333-8333-333333333333' },
      });
      const user = userEvent.setup();
      renderBooking();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^20:00, / }));

      expect(card()).toHaveTextContent('R$ 180');
      expect(card()).toHaveTextContent('Qui, 5 nov · 20:00–21:00');
      await user.click(
        within(card()).getByRole('button', { name: 'Reservar' }),
      );

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          '/reservas/33333333-3333-4333-8333-333333333333?jogadores=14',
        );
      });
    });

    it('hands the checkout the group size it was booked for', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: true,
        data: { id: '33333333-3333-4333-8333-333333333333' },
      });
      const user = userEvent.setup();
      renderBooking({ initialPlayers: 12 });
      await loaded();
      await user.click(screen.getByRole('button', { name: /^20:00, / }));
      await user.click(
        within(card()).getByRole('button', { name: 'Reservar' }),
      );

      await waitFor(() => {
        expect(mocks.navigate).toHaveBeenCalledWith(
          '/reservas/33333333-3333-4333-8333-333333333333?jogadores=12',
        );
      });
    });

    it('keeps the group, the switch and the total under the times', async () => {
      const user = userEvent.setup();
      renderBooking();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^20:00, / }));

      const panel = screen.getByRole('region', { name: 'Sua reserva' });
      expect(
        within(panel).getByRole('button', { name: 'Mais um jogador' }),
      ).toBeInTheDocument();
      expect(within(panel).getByRole('switch')).toBeInTheDocument();
      expect(
        within(panel).getByRole('status', { name: 'Resumo da reserva' }),
      ).toHaveTextContent('Por pessoa (14)R$ 12,86');
      // Only one of everything: the card keeps just the bar.
      expect(screen.getAllByRole('switch')).toHaveLength(1);
    });

    it('shows a refused booking under the times', async () => {
      mocks.createBooking.mockResolvedValue({
        ok: false,
        status: 422,
        fieldErrors: {},
        message: 'Você já tem reservas aguardando pagamento',
      });
      const user = userEvent.setup();
      renderBooking();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^20:00, / }));
      await user.click(
        within(card()).getByRole('button', { name: 'Reservar' }),
      );

      const panel = screen.getByRole('region', { name: 'Sua reserva' });
      expect(await within(panel).findByRole('alert')).toHaveTextContent(
        'Você já tem reservas aguardando pagamento',
      );
    });
  });

  it('says there is nothing to book when the venue has no court', () => {
    stubViewport(false);
    render(
      <BookingProvider
        slug="arena-x"
        timezone="America/Sao_Paulo"
        fields={[]}
        signedIn={false}
      >
        <BookingCard price={null} />
      </BookingProvider>,
    );

    expect(card()).toHaveTextContent(
      'Este espaço ainda não tem quadras para reservar.',
    );
    expect(within(card()).queryByRole('button')).toBeNull();
  });
});
