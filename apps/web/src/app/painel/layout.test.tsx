import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  apiGet: vi.fn(),
  redirect: vi.fn((): never => {
    // Next's redirect() throws to abort rendering; the layout relies on that.
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith('NEXT_')) {
      throw error;
    }
  },
  usePathname: () => '/painel',
}));

import PainelLayout, { metadata } from './layout';

const USER = {
  id: 'u1',
  name: 'Maria Souza',
  email: 'maria@mail.com',
  createdAt: '2026-10-28T12:00:00.000Z',
};

const VENUE = {
  id: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10',
  slug: 'arena-vila-madalena',
  name: 'Arena Vila Madalena',
  status: 'published',
  city: 'São Paulo',
  fieldsCount: 3,
  coverUrl: null,
  coverSrcSet: null,
};

describe('/painel layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue([VENUE]);
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

  it('shows the sidebar with the DONO tag, the navigation, the venue and the page', async () => {
    mocks.getSession.mockResolvedValue(USER);

    render(await PainelLayout({ children: <p>conteúdo</p> }));

    // The prototype has no top bar: the logo and the tag open the sidebar.
    expect(screen.queryByRole('banner')).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Painel do dono' });
    expect(
      within(nav).getByRole('link', { name: 'ArenaZ, início' }),
    ).toHaveAttribute('href', '/');
    expect(within(nav).getByText('DONO')).toBeVisible();
    expect(
      within(nav).getByRole('link', { name: 'Meus espaços' }),
    ).toHaveAttribute('href', '/painel');
    expect(within(nav).getByRole('link', { name: 'Conta' })).toHaveAttribute(
      'href',
      '/conta',
    );
    // The owner call to action makes no sense inside the owner panel.
    expect(
      screen.queryByRole('link', { name: 'Anuncie sua quadra' }),
    ).toBeNull();
    // The only venue is in context: its card and first name of the owner.
    expect(within(nav).getByText('Arena Vila Madalena')).toBeVisible();
    expect(within(nav).getByText('3 quadras · Maria')).toBeVisible();
    expect(mocks.apiGet).toHaveBeenCalledWith(
      '/owner/venues',
      expect.anything(),
      '/painel',
    );
    expect(screen.getByRole('main')).toHaveTextContent('conteúdo');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('still renders the panel when the venue list fails', async () => {
    mocks.getSession.mockResolvedValue(USER);
    mocks.apiGet.mockRejectedValue(new Error('GET falhou com status 500'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {
      // silence the expected error log
    });

    render(await PainelLayout({ children: <p>conteúdo</p> }));

    expect(
      screen.getByRole('navigation', { name: 'Painel do dono' }),
    ).toBeVisible();
    expect(screen.queryByText('Arena Vila Madalena')).toBeNull();
    expect(logged).toHaveBeenCalledWith(
      'Lista de espaços do painel indisponível',
      expect.any(Error),
    );
    logged.mockRestore();
    expect(screen.getByRole('main')).toHaveTextContent('conteúdo');
  });

  it('lets a redirect of the venue list through (expired session)', async () => {
    mocks.getSession.mockResolvedValue(USER);
    mocks.apiGet.mockRejectedValue(new Error('NEXT_REDIRECT'));

    await expect(PainelLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT',
    );
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
