import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingSummary } from './booking-summary';

describe('BookingSummary', () => {
  it('is a labelled live region', () => {
    render(<BookingSummary selection={null} />);

    expect(
      screen.getByRole('status', { name: 'Resumo da reserva' }),
    ).toBeInTheDocument();
  });

  it('asks for a time when nothing is picked', () => {
    render(<BookingSummary selection={null} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Escolha um horário para ver o valor.',
    );
  });

  it('shows court, day, range and total of the choice', () => {
    render(
      <BookingSummary
        selection={{
          fieldName: 'Quadra 2',
          dayLabel: 'Sex 6',
          timeRange: '18:00–19:30',
          totalCents: 27050,
        }}
      />,
    );

    const summary = screen.getByRole('status');
    expect(summary).toHaveTextContent('Quadra 2');
    expect(summary).toHaveTextContent('Sex 6');
    expect(summary).toHaveTextContent('18:00–19:30');
    expect(summary).toHaveTextContent('R$ 270,50');
    expect(summary).not.toHaveTextContent('Escolha um horário');
  });

  it('writes the time range in the mono face', () => {
    render(
      <BookingSummary
        selection={{
          fieldName: 'Quadra 1',
          dayLabel: 'Hoje',
          timeRange: '18:00–19:00',
          totalCents: 18000,
        }}
      />,
    );

    expect(screen.getByText('18:00–19:00')).toHaveClass('font-mono');
  });
});
