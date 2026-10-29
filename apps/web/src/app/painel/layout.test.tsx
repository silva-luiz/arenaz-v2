import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((): never => {
    // Next's redirect() throws to abort rendering; the layout relies on that.
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  usePathname: () => '/painel',
}));

import PainelLayout from './layout';

describe('/painel layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /entrar?next=/painel when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(PainelLayout({ children: <p>conteúdo</p> })).rejects.toThrow(
      'NEXT_REDIRECT',
    );

    expect(mocks.redirect).toHaveBeenCalledWith('/entrar?next=/painel');
  });

  it('shows the logo, the user name, the navigation and the page', async () => {
    mocks.getSession.mockResolvedValue({
      id: 'u1',
      name: 'Maria',
      email: 'maria@mail.com',
      createdAt: '2026-10-28T12:00:00.000Z',
    });

    render(await PainelLayout({ children: <p>conteúdo</p> }));

    expect(
      screen.getByRole('link', { name: 'arenaz, página inicial' }),
    ).toHaveAttribute('href', '/');
    expect(screen.getByText('Olá, Maria')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Meus espaços' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conta' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('conteúdo');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
