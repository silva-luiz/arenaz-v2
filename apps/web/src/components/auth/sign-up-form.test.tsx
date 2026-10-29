import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  replace: vi.fn(),
  search: { current: '' },
}));

vi.mock('@/lib/auth-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-client')>()),
  authClient: { signUp: { email: mocks.signUpEmail } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search.current),
}));

import { SignUpForm } from './sign-up-form';

const STRONG_PASSWORD = 'Senha@123';

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  password = STRONG_PASSWORD,
) {
  await user.type(screen.getByLabelText('Nome'), 'Joao');
  await user.type(screen.getByLabelText('E-mail'), ' Joao@Mail.com ');
  await user.type(screen.getByLabelText('Senha'), password);
}

describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search.current = '';
  });

  it('mostra erro de senha fraca sem chamar a API', async () => {
    const user = userEvent.setup();
    render(<SignUpForm />);

    await user.type(screen.getByLabelText('Nome'), 'Joao');
    await user.type(screen.getByLabelText('E-mail'), 'joao@mail.com');
    await user.type(screen.getByLabelText('Senha'), 'fraca');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/8\+ caracteres/)).toBeVisible();
    expect(screen.getByLabelText('Senha')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it('mostra detail do servidor quando e-mail já existe', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'Já existe uma conta com este e-mail' },
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    // The alert region is always mounted, so wait for the text itself.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Já existe uma conta com este e-mail',
      );
    });
  });

  it('puts server field errors under the fields', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        title: 'Dados inválidos',
        errors: { email: ['E-mail inválido'] },
      },
    });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('E-mail inválido')).toBeVisible();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
      'E-mail inválido',
    );
  });

  it('sends normalised values and goes to /conta on success', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await vi.waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/conta');
    });
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      name: 'Joao',
      email: 'joao@mail.com',
      password: STRONG_PASSWORD,
    });
  });

  it('honours a safe ?next', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { user: {} }, error: null });
    mocks.search.current = 'next=/reservas%3Fx%3D1';
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await vi.waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/reservas?x=1');
    });
  });

  it('ignores an open-redirect ?next', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: { user: {} }, error: null });
    mocks.search.current = 'next=//evil.com';
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await vi.waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/conta');
    });
  });

  it('shows a generic alert when the request itself fails', async () => {
    mocks.signUpEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<SignUpForm />);

    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    // The alert region is always mounted, so wait for the text itself.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível concluir. Tente novamente.',
      );
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
