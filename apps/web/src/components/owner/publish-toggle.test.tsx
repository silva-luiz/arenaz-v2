import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
}));

import { PublishToggle } from './publish-toggle';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('PublishToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers "Publicar" for a draft and "Despublicar" for a published venue', () => {
    const { rerender } = render(
      <PublishToggle venueId={VENUE_ID} status="draft" />,
    );
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeVisible();

    rerender(<PublishToggle venueId={VENUE_ID} status="published" />);
    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeVisible();
  });

  it('publishes without a body and refreshes', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<PublishToggle venueId={VENUE_ID} status="draft" />);

    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Espaço publicado');
    const call = mocks.apiSend.mock.calls[0] as unknown[];
    expect(call[0]).toBe('POST');
    expect(call[1]).toBe(`/owner/venues/${VENUE_ID}/publish`);
    expect(call[2]).toBeUndefined();
  });

  it('unpublishes through the unpublish route', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });
    const user = userEvent.setup();
    render(<PublishToggle venueId={VENUE_ID} status="published" />);

    await user.click(screen.getByRole('button', { name: 'Despublicar' }));

    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[1]).toBe(
      `/owner/venues/${VENUE_ID}/unpublish`,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Espaço despublicado');
  });

  it('lists what is missing when publishing is refused with 422', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      message: 'Complete o espaço antes de publicar',
      fieldErrors: {
        hours: ['Defina o horário de funcionamento'],
        fields: ['Cadastre pelo menos uma quadra ativa'],
        photos: ['Adicione pelo menos uma foto'],
      },
    });
    const user = userEvent.setup();
    render(<PublishToggle venueId={VENUE_ID} status="draft" />);

    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    const alert = await screen.findByText(
      'Complete o espaço antes de publicar',
    );
    const region = screen.getByRole('alert');
    expect(region).toContainElement(alert);
    const items = within(within(region).getByRole('list')).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'Defina o horário de funcionamento',
      'Cadastre pelo menos uma quadra ativa',
      'Adicione pelo menos uma foto',
    ]);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('shows a plain message when there is no list of problems', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 500,
      message: 'Não foi possível concluir. Tente novamente.',
      fieldErrors: {},
    });
    const user = userEvent.setup();
    render(<PublishToggle venueId={VENUE_ID} status="draft" />);

    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível concluir. Tente novamente.',
      );
    });
    expect(screen.queryByRole('list')).toBeNull();
  });
});
