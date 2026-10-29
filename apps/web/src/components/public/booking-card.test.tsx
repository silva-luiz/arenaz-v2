import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookingCard } from './booking-card';

describe('BookingCard', () => {
  it('shows the lowest price as "a partir de" and says booking is coming', () => {
    render(<BookingCard minPriceCentsPerHour={9000} />);

    const card = screen.getByRole('complementary', { name: 'Reserva' });
    expect(card).toHaveTextContent('a partir de');
    expect(card).toHaveTextContent('R$ 90 / hora');
    expect(card).toHaveTextContent('Reserva online chega em breve.');
  });

  it('has a "Escolher horário" button that is aria-disabled, focusable and explained', async () => {
    const user = userEvent.setup();
    render(<BookingCard minPriceCentsPerHour={9000} />);

    const button = screen.getByRole('button', { name: 'Escolher horário' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, not disabled: it stays in the tab order.
    expect(button).not.toBeDisabled();
    const explanation = document.getElementById(
      button.getAttribute('aria-describedby') ?? '',
    );
    expect(explanation).toHaveTextContent('Reserva online chega em breve.');

    await user.tab();
    expect(button).toHaveFocus();
  });

  it('does nothing when clicked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <BookingCard minPriceCentsPerHour={9000} />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Escolher horário' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is a bar that sticks above the tab bar on a phone and a card from lg up', () => {
    render(<BookingCard minPriceCentsPerHour={9000} />);

    const card = screen.getByRole('complementary', { name: 'Reserva' });
    // Sticky, not fixed: in flow at the end of the page, so it never covers
    // the content or the footer.
    expect(card).toHaveClass('sticky', 'lg:rounded-card', 'lg:shadow-3');
    expect(card).not.toHaveClass('fixed');
  });

  it('omits the price when no court is known', () => {
    render(<BookingCard minPriceCentsPerHour={null} />);

    expect(screen.queryByText('a partir de')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Escolher horário' }),
    ).toBeInTheDocument();
  });
});
