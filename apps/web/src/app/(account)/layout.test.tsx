import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rethrow: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/entrar',
  unstable_rethrow: mocks.rethrow,
}));

import AccountLayout, { metadata } from './layout';

describe('(account) layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rethrow.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('wraps the page in the site header and footer, without the tab bar', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await AccountLayout({ children: <p>formulário</p> }));

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByText('formulário'),
    ).toBeVisible();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Navegação principal' }),
    ).toBeNull();
  });

  it('makes <main> the target of the skip link', async () => {
    mocks.getSession.mockResolvedValue(null);

    render(await AccountLayout({ children: null }));

    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
    expect(
      screen.getByRole('link', { name: 'Pular para o conteúdo' }),
    ).toHaveAttribute('href', '#conteudo');
  });

  it('offers "Entrar" when signed out and the avatar when signed in', async () => {
    mocks.getSession.mockResolvedValue(null);
    const { unmount } = render(await AccountLayout({ children: null }));
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeVisible();
    unmount();

    mocks.getSession.mockResolvedValue({
      id: 'u1',
      name: 'Maria Souza',
      email: 'maria@mail.com',
      createdAt: '2026-10-28T12:00:00.000Z',
    });
    render(await AccountLayout({ children: null }));
    expect(
      screen.getByRole('link', { name: 'Minha conta (MS)' }),
    ).toBeVisible();
  });

  it('degrades to the signed-out header when the session lookup fails', async () => {
    mocks.getSession.mockRejectedValue(new Error('GET /api/me falhou'));

    render(await AccountLayout({ children: <p>formulário</p> }));

    expect(screen.getByRole('link', { name: 'Entrar' })).toBeVisible();
    expect(screen.getByText('formulário')).toBeVisible();
  });

  it('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
