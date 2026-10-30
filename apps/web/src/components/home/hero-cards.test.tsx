import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfirmedBookingCard, RachaCard, rachaShareLabel } from './hero-cards';
import { HERO_SHOWCASE_MOCK } from './hero-showcase';

describe('hero cards', () => {
  it('draws the confirmed booking from its data', () => {
    render(
      <ConfirmedBookingCard
        booking={{
          venueName: 'Padel Pinheiros',
          when: 'Amanhã · 19h às 20h · quadra 1',
          code: '#AZ-1002',
          photoUrl: '/foto.jpg',
        }}
      />,
    );

    expect(screen.getByText('Reserva confirmada')).toBeInTheDocument();
    expect(screen.getByText('Padel Pinheiros')).toBeInTheDocument();
    expect(
      screen.getByText('Amanhã · 19h às 20h · quadra 1'),
    ).toBeInTheDocument();
    expect(screen.getByText('#AZ-1002')).toBeInTheDocument();
  });

  it('leaves the booking code out of the compact phone card', () => {
    render(
      <ConfirmedBookingCard compact booking={HERO_SHOWCASE_MOCK.booking} />,
    );

    expect(screen.getByText('Reserva confirmada')).toBeInTheDocument();
    expect(screen.getByText('Arena Vila Madalena')).toBeInTheDocument();
    expect(
      screen.getByText('Hoje · 20h às 22h · quadra 2'),
    ).toBeInTheDocument();
    expect(screen.queryByText('#AZ-4821')).not.toBeInTheDocument();
  });

  it('keeps the whole racha in the compact phone card', () => {
    render(<RachaCard compact racha={HERO_SHOWCASE_MOCK.racha} />);

    expect(screen.getByText('9 de 14 pagaram')).toBeInTheDocument();
    expect(screen.getByTestId('racha-progress')).toHaveStyle({ width: '64%' });
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('draws the racha progress from paid and total', () => {
    render(<RachaCard racha={HERO_SHOWCASE_MOCK.racha} />);

    expect(screen.getByText('Racha no Pix')).toBeInTheDocument();
    expect(screen.getByText('R$ 33/cada')).toBeInTheDocument();
    expect(screen.getByText('9 de 14 pagaram')).toBeInTheDocument();
    expect(screen.getByTestId('racha-progress')).toHaveStyle({ width: '64%' });
    for (const initials of ['GR', 'AL', 'JP', 'MT', 'BS']) {
      expect(screen.getByText(initials)).toBeInTheDocument();
    }
    // 9 paid, 5 faces drawn: the rest is a count.
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('draws at most 5 faces and no count when everyone shows', () => {
    render(
      <RachaCard
        racha={{
          perPersonCents: 2550,
          paid: 3,
          total: 10,
          payers: ['AA', 'BB', 'CC'],
        }}
      />,
    );

    expect(screen.getByText('3 de 10 pagaram')).toBeInTheDocument();
    expect(screen.getByTestId('racha-progress')).toHaveStyle({ width: '30%' });
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('keeps an empty racha at 0% instead of dividing by zero', () => {
    render(
      <RachaCard
        racha={{ perPersonCents: 0, paid: 0, total: 0, payers: [] }}
      />,
    );

    expect(screen.getByTestId('racha-progress')).toHaveStyle({ width: '0%' });
  });

  it('labels whole reais without cents and keeps the cents otherwise', () => {
    expect(rachaShareLabel(3300)).toBe('R$ 33/cada');
    expect(rachaShareLabel(2550)).toBe('R$ 25,50/cada');
  });
});
