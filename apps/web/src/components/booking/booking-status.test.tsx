import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingStatusBadge } from './booking-status';

describe('BookingStatusBadge', () => {
  it.each([
    ['held', 'Aguardando pagamento'],
    ['confirmed', 'Confirmada'],
    ['cancelled', 'Cancelada'],
    ['expired', 'Expirada'],
  ] as const)('labels %s as "%s"', (status, label) => {
    render(<BookingStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
  });
});
