import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  pathname: '/',
  rethrow: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
  unstable_rethrow: mocks.rethrow,
}));

import PublicLayout from './layout';

const USER = {
  id: 'u1',
  name: 'Maria Souza',
  email: 'maria@mail.com',
  createdAt: '2026-10-28T12:00:00.000Z',
};

describe('(public) layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rethrow.mockReset();
    mocks.pathname = '/';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders header, main with the page, footer and tab bar', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await PublicLayout({ children: <p>conteúdo</p> }));

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByText('conteúdo'),
    ).toBeVisible();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Navegação principal' }),
    ).toBeInTheDocument();
  });

  it('makes <main> the focusable target of the skip link, without a focus ring', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await PublicLayout({ children: null }));

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'conteudo');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toHaveClass('outline-none');
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo');
  });

  it('keeps the 1360px column on ordinary pages and goes full width on /buscar', async () => {
    mocks.getSession.mockResolvedValue(null);
    mocks.pathname = '/espacos/arena-1';
    const { unmount } = render(await PublicLayout({ children: null }));
    expect(screen.getByRole('main')).toHaveClass('max-w-[1360px]');
    unmount();

    mocks.pathname = '/buscar';
    render(await PublicLayout({ children: null }));
    expect(screen.getByRole('main')).not.toHaveClass('max-w-[1360px]');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it('leaves the bottom spacing to the tab bar spacer, not to <main>', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await PublicLayout({ children: null }));

    expect(screen.getByRole('main').className).not.toMatch(/(^|\s)pb-/);
    expect(screen.getByTestId('tab-bar-spacer')).toBeInTheDocument();
  });

  it('shows "Entrar" and the owner link when signed out', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await PublicLayout({ children: null }));

    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(
      screen.getByRole('link', { name: 'Anuncie sua quadra' }),
    ).toHaveAttribute('href', '/painel');
  });

  it('shows the user avatar when signed in', async () => {
    mocks.getSession.mockResolvedValue(USER);

    render(await PublicLayout({ children: null }));

    expect(
      screen.getByRole('link', { name: 'Minha conta (MS)' }),
    ).toHaveAttribute('href', '/conta');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('degrades to the signed-out header when the session lookup fails', async () => {
    mocks.getSession.mockRejectedValue(new Error('GET /api/me falhou'));

    render(await PublicLayout({ children: <p>conteúdo</p> }));

    expect(screen.getByRole('link', { name: 'Entrar' })).toBeVisible();
    expect(screen.getByText('conteúdo')).toBeVisible();
  });

  it('lets the dynamic-rendering signal through instead of swallowing it', async () => {
    const signal = new Error('DYNAMIC_SERVER_USAGE');
    mocks.getSession.mockRejectedValue(signal);
    mocks.rethrow.mockImplementation((error: unknown) => {
      throw error;
    });

    await expect(PublicLayout({ children: null })).rejects.toBe(signal);
  });

  it.each([
    ['/', 'Explorar'],
    ['/buscar', 'Explorar'],
    ['/espacos/arena-1', 'Explorar'],
  ])('marks the right tab on %s', async (pathname, label) => {
    mocks.getSession.mockResolvedValue(null);
    mocks.pathname = pathname;

    render(await PublicLayout({ children: null }));

    const nav = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    expect(
      within(nav).getByRole('link', { current: 'page' }),
    ).toHaveAccessibleName(label);
  });
});
