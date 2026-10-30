import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import { DeleteVenueButton } from './delete-venue-button';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('DeleteVenueButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('asks for confirmation before deleting anything', async () => {
    const user = userEvent.setup();
    render(<DeleteVenueButton venueId={VENUE_ID} />);

    await user.click(screen.getByRole('button', { name: 'Excluir espaço' }));

    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(screen.getByText(/não pode ser desfeita/i)).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    ).toBeVisible();
  });

  it('cancels the confirmation without calling the API', async () => {
    const user = userEvent.setup();
    render(<DeleteVenueButton venueId={VENUE_ID} />);

    await user.click(screen.getByRole('button', { name: 'Excluir espaço' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.getByRole('button', { name: 'Excluir espaço' }),
    ).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('deletes with no body and goes back to the list', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(<DeleteVenueButton venueId={VENUE_ID} />);

    await user.click(screen.getByRole('button', { name: 'Excluir espaço' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/painel');
    });
    expect(mocks.refresh).toHaveBeenCalled();
    const call = mocks.apiSend.mock.calls[0] as unknown[];
    expect(call[0]).toBe('DELETE');
    expect(call[1]).toBe(`/owner/venues/${VENUE_ID}`);
    expect(call[2]).toBeUndefined();
  });

  it('shows the error and stays when the API refuses', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 500,
      message: 'Não foi possível concluir. Tente novamente.',
      fieldErrors: {},
    });
    const user = userEvent.setup();
    render(<DeleteVenueButton venueId={VENUE_ID} />);

    await user.click(screen.getByRole('button', { name: 'Excluir espaço' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível concluir. Tente novamente.',
      );
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
