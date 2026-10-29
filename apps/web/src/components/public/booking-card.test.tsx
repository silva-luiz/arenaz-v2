import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The picker has its own tests; here it only needs to be findable.
const mocks = vi.hoisted(() => ({ pickerMounts: vi.fn() }));
vi.mock('@/components/booking/slot-picker', async () => {
  const { useEffect } = await import('react');
  return {
    SlotPicker: (props: { slug: string; signedIn: boolean }) => {
      useEffect(() => {
        mocks.pickerMounts();
      }, []);
      return (
        <div data-testid="picker" data-slug={props.slug}>
          <button type="button">Dentro do seletor</button>
        </div>
      );
    },
  };
});

import { BookingCard } from './booking-card';

const FIELDS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Quadra 1',
    minSlotMinutes: 60,
  },
];

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

function renderCard(
  props: Partial<React.ComponentProps<typeof BookingCard>> = {},
) {
  return render(
    <BookingCard
      slug="arena-x"
      timezone="America/Sao_Paulo"
      fields={FIELDS}
      minPriceCentsPerHour={9000}
      signedIn={false}
      {...props}
    />,
  );
}

describe('BookingCard', () => {
  beforeEach(() => {
    mocks.pickerMounts.mockClear();
    stubViewport(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the lowest price as "a partir de"', () => {
    renderCard();

    const card = screen.getByRole('complementary', { name: 'Reserva' });
    expect(card).toHaveTextContent('a partir de');
    expect(card).toHaveTextContent('R$ 90 / hora');
  });

  it('omits the price when no court is known', () => {
    renderCard({ minPriceCentsPerHour: null });

    expect(screen.queryByText('a partir de')).not.toBeInTheDocument();
  });

  it('is a bar that sticks above the tab bar on a phone and a card from lg up', () => {
    renderCard();

    const card = screen.getByRole('complementary', { name: 'Reserva' });
    // Sticky, not fixed: in flow at the end of the page, so it never covers
    // the content or the footer.
    expect(card).toHaveClass('sticky', 'lg:rounded-card', 'lg:shadow-3');
    // A fixed height from the shared variable, which also feeds the page's
    // scroll padding so focus does not hide under the bar.
    expect(card).toHaveClass('h-(--booking-bar-h)', 'lg:h-auto');
    expect(card).toHaveAttribute('data-booking-bar');
    expect(card).not.toHaveClass('fixed');
  });

  describe('on a phone', () => {
    it('has an enabled "Escolher horário" button and no picker yet', () => {
      renderCard();

      expect(
        screen.getByRole('button', { name: 'Escolher horário' }),
      ).toBeEnabled();
      expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
    });

    it('opens the picker in a modal dialog with focus inside', async () => {
      const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
      const user = userEvent.setup();
      renderCard({ signedIn: true });

      await user.click(
        screen.getByRole('button', { name: 'Escolher horário' }),
      );

      expect(showModal).toHaveBeenCalledTimes(1);
      const dialog = screen.getByRole('dialog', { name: 'Escolha o horário' });
      expect(within(dialog).getByTestId('picker')).toHaveAttribute(
        'data-slug',
        'arena-x',
      );
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('closes with "Fechar" and gives the focus back to the button', async () => {
      const user = userEvent.setup();
      renderCard();
      const trigger = screen.getByRole('button', { name: 'Escolher horário' });
      await user.click(trigger);

      await user.click(screen.getByRole('button', { name: 'Fechar' }));

      expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('closes with Esc and gives the focus back to the button', async () => {
      const user = userEvent.setup();
      renderCard();
      const trigger = screen.getByRole('button', { name: 'Escolher horário' });
      await user.click(trigger);

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('opens by itself when the person comes back from sign in with a choice', async () => {
      renderCard({
        signedIn: true,
        initial: {
          date: '2026-11-06',
          fieldId: FIELDS[0]?.id ?? '',
          startsAt: '2026-11-06T18:00:00.000-03:00',
          durationMinutes: 60,
        },
      });

      expect(
        await screen.findByRole('dialog', { name: 'Escolha o horário' }),
      ).toBeInTheDocument();
    });
  });

  describe('from lg up', () => {
    beforeEach(() => {
      stubViewport(true);
    });

    it('mounts a single picker and no dialog even with a saved choice', () => {
      renderCard({
        signedIn: true,
        initial: {
          date: '2026-11-06',
          fieldId: FIELDS[0]?.id ?? '',
          startsAt: '2026-11-06T18:00:00.000-03:00',
          durationMinutes: 60,
        },
      });

      expect(screen.getAllByTestId('picker')).toHaveLength(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mocks.pickerMounts).toHaveBeenCalledTimes(1);
    });

    it('keeps the picker in the card, with no button and no dialog', () => {
      renderCard();

      const card = screen.getByRole('complementary', { name: 'Reserva' });
      expect(within(card).getByTestId('picker')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Escolher horário' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('says there is nothing to book when the venue has no court', () => {
    renderCard({ fields: [], minPriceCentsPerHour: null });

    expect(
      screen.getByText('Este espaço ainda não tem quadras para reservar.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Escolher horário' }),
    ).not.toBeInTheDocument();
  });
});
