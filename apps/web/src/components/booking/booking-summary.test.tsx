import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingSummary, formatDuration } from './booking-summary';

const CHOICE = {
  fieldName: 'Quadra 2',
  whenLabel: 'Sex, 6 nov',
  timeRange: '18:00–19:30',
  durationMinutes: 90,
  totalCents: 27050,
};

describe('formatDuration', () => {
  it('writes hours and minutes the short way', () => {
    expect(formatDuration(60)).toBe('1 hora');
    expect(formatDuration(120)).toBe('2 horas');
    expect(formatDuration(90)).toBe('1h30');
    expect(formatDuration(30)).toBe('30 min');
  });
});

describe('BookingSummary', () => {
  it('is a labelled live region, empty and out of the flow until a time is picked', () => {
    render(<BookingSummary choice={null} players={14} split />);

    const summary = screen.getByRole('status', { name: 'Resumo da reserva' });
    expect(summary).toBeEmptyDOMElement();
    expect(summary).toHaveClass('sr-only');
  });

  it('tells court, day and range to a screen reader, and the hours and total to everyone', () => {
    render(<BookingSummary choice={CHOICE} players={14} split={false} />);

    const summary = screen.getByRole('status');
    expect(summary).toHaveTextContent('Quadra 2, Sex, 6 nov, 18:00–19:30.');
    expect(screen.getByText('Confirmação na hora do pagamento')).toBeVisible();
    expect(screen.getByText('1h30')).toBeInTheDocument();
    expect(summary).toHaveTextContent('TotalR$ 270,50');
    expect(summary).not.toHaveTextContent(/taxa/i);
    expect(summary).not.toHaveTextContent('Por pessoa');
  });

  it('shows each player share, rounded up to the cent, while splitting', () => {
    render(<BookingSummary choice={CHOICE} players={4} split />);

    // 270,50 / 4 = 67,625 -> 67,63.
    expect(screen.getByRole('status')).toHaveTextContent(
      'Por pessoa (4)R$ 67,63',
    );
  });
});
