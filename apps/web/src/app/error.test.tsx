import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';

const SECRET = new Error('connect ECONNREFUSED 10.0.0.5:5432 at Pool.query');

describe('error page', () => {
  it('shows a pt-BR message and never the error text', () => {
    render(<ErrorPage error={SECRET} reset={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeVisible();
    expect(
      screen.getByText('Não foi possível carregar esta página. Tente de novo.'),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent('ECONNREFUSED');
    expect(document.body).not.toHaveTextContent('Pool.query');
  });

  it('retries through reset()', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorPage error={SECRET} reset={reset} />);

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('offers a way back to the home page', () => {
    render(<ErrorPage error={SECRET} reset={vi.fn()} />);

    expect(
      screen.getByRole('link', { name: 'Ir para o início' }),
    ).toHaveAttribute('href', '/');
  });
});
