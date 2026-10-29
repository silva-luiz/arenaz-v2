import { render, screen, within } from '@testing-library/react';
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

import PainelLayout, { metadata } from './layout';

const USER = {
  id: 'u1',
  name: 'Maria Souza',
  email: 'maria@mail.com',
  createdAt: '2026-10-28T12:00:00.000Z',
};

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

  it('is kept out of search engines, for every page under /painel', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('shows the design-system header with the DONO tag, the user, the navigation and the page', async () => {
    mocks.getSession.mockResolvedValue(USER);

    render(await PainelLayout({ children: <p>conteúdo</p> }));

    const header = screen.getByRole('banner');
    expect(
      within(header).getByRole('link', { name: 'ArenaZ, início' }),
    ).toHaveAttribute('href', '/');
    expect(within(header).getByText('DONO')).toBeVisible();
    expect(
      within(header).getByRole('link', { name: 'Minha conta (MS)' }),
    ).toHaveAttribute('href', '/conta');
    // The owner call to action makes no sense inside the owner panel.
    expect(
      screen.queryByRole('link', { name: 'Anuncie sua quadra' }),
    ).toBeNull();
    expect(screen.getByText('Olá, Maria Souza')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Meus espaços' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Conta' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('conteúdo');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('has no tab bar and offers a skip link to the content', async () => {
    mocks.getSession.mockResolvedValue(USER);

    render(await PainelLayout({ children: null }));

    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).toBeNull();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo');
  });
});
