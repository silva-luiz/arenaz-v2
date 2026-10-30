import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: mocks.signOut },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import { SignOutButton } from './sign-out-button';

describe('SignOutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signs out, then goes home and refreshes server data', async () => {
    mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await vi.waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/');
    });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
