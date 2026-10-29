import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));

import { DeleteButton } from './delete-button';

const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';
const VENUE_PATH = '/painel/espacos/3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

function renderButton() {
  render(
    <DeleteButton
      label="Excluir quadra"
      warning="Excluir a quadra apaga também preços e bloqueios. Esta ação não pode ser desfeita."
      path={`/owner/fields/${FIELD_ID}`}
      redirectTo={VENUE_PATH}
    />,
  );
}

describe('DeleteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the warning first and calls nothing', async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Excluir quadra' }));

    expect(
      screen.getByText(
        'Excluir a quadra apaga também preços e bloqueios. Esta ação não pode ser desfeita.',
      ),
    ).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('deletes with no body and goes to the page it was given', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Excluir quadra' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(VENUE_PATH);
    });
    const call = mocks.apiSend.mock.calls[0] as unknown[];
    expect(call[0]).toBe('DELETE');
    expect(call[1]).toBe(`/owner/fields/${FIELD_ID}`);
    expect(call[2]).toBeUndefined();
  });

  it('shows the 422 detail of a published venue and stays', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: {},
      message: 'Despublique o espaço antes de deixá-lo incompleto',
    });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Excluir quadra' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Despublique o espaço antes de deixá-lo incompleto',
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
