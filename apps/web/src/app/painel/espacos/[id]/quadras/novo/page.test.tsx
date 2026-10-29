import type { Venue } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import NovaQuadraPage from './page';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

const VENUE = { id: ID, name: 'Arena Central' } as Venue;

describe('/painel/espacos/[id]/quadras/novo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue(VENUE);
  });

  it('loads the venue first (404 for another owner), with its own path for the sign-in redirect', async () => {
    await NovaQuadraPage({ params: Promise.resolve({ id: ID }) });

    expect(mocks.apiGet.mock.calls[0]?.[0]).toBe(`/owner/venues/${ID}`);
    expect(mocks.apiGet.mock.calls[0]?.[2]).toBe(
      `/painel/espacos/${ID}/quadras/novo`,
    );
  });

  it('shows the heading, a link back to the venue and the create form', async () => {
    render(await NovaQuadraPage({ params: Promise.resolve({ id: ID }) }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Nova quadra' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Arena Central/ })).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}`,
    );
    expect(screen.getByLabelText('Nome da quadra')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Criar quadra' })).toBeVisible();
  });
});
