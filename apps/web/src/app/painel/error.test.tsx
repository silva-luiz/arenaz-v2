import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PainelError from './error';

const SECRET = new Error('GET /api/owner/venues falhou com status 500');

describe('/painel error page', () => {
  it('shows a pt-BR message, hides the error text and offers a way back to the panel', () => {
    render(<PainelError error={SECRET} reset={vi.fn()} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent('status 500');
    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'href',
      '/painel',
    );
  });

  it('retries through reset()', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<PainelError error={SECRET} reset={reset} />);

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
