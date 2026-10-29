import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  replace: vi.fn(),
  search: { current: '' },
}));

vi.mock('@/lib/auth-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-client')>()),
  authClient: { signIn: { email: mocks.signInEmail } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search.current),
}));

import { SignInForm } from './sign-in-form';

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.current = '';
  });

  it('requires e-mail and password before calling the API', async () => {
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe a senha')).toBeVisible();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it('shows the server detail on wrong credentials', async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: {
        status: 401,
        title: 'Não autenticado',
        detail: 'E-mail ou senha inválidos',
      },
    });
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText('E-mail'), 'joao@mail.com');
    await user.type(screen.getByLabelText('Senha'), 'Errada@123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'E-mail ou senha inválidos',
    );
  });

  it('signs in and follows ?next when it is a local path', async () => {
    mocks.signInEmail.mockResolvedValue({ data: { user: {} }, error: null });
    mocks.search.current = 'next=/conta';
    const user = userEvent.setup();
    render(<SignInForm />);

    await user.type(screen.getByLabelText('E-mail'), 'joao@mail.com');
    await user.type(screen.getByLabelText('Senha'), 'Senha@123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await vi.waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/conta');
    });
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: 'joao@mail.com',
      password: 'Senha@123',
    });
  });
});
