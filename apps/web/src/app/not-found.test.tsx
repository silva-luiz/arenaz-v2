import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from './not-found';

describe('not-found page', () => {
  it('explains in pt-BR, without saying whether the page exists for someone else', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeVisible();
    expect(
      screen.getByText('O endereço não existe ou você não tem acesso a ele.'),
    ).toBeVisible();
  });

  it('links back to the home page and to the owner panel', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('link', { name: 'Ir para o início' }),
    ).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Meus espaços' })).toHaveAttribute(
      'href',
      '/painel',
    );
  });
});
