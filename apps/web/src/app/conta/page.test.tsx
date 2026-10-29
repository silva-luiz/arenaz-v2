import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((): never => {
    // Next's redirect() throws to abort rendering; the page relies on that.
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('@/lib/session', () => ({ getSession: mocks.getSession }));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: vi.fn() } }));

import ContaPage from './page';

describe('/conta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /entrar?next=/conta when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(ContaPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/entrar?next=/conta');
  });

  it('greets the signed-in user and offers to sign out', async () => {
    mocks.getSession.mockResolvedValue({
      id: 'u1',
      name: 'Maria',
      email: 'maria@mail.com',
      createdAt: '2026-10-28T12:00:00.000Z',
    });

    render(await ContaPage());

    expect(screen.getByText('Olá, Maria')).toBeVisible();
    expect(screen.getByText('maria@mail.com')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeVisible();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
