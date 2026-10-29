import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));

import PainelPage from './page';

const ID_A = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const ID_B = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

describe('/painel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the owner venues, passing its own path for the sign-in redirect', async () => {
    mocks.apiGet.mockResolvedValue([]);

    await PainelPage();

    expect(mocks.apiGet.mock.calls[0]?.[0]).toBe('/owner/venues');
    expect(mocks.apiGet.mock.calls[0]?.[2]).toBe('/painel');
  });

  it('invites the owner to create the first venue when there is none', async () => {
    mocks.apiGet.mockResolvedValue([]);

    render(await PainelPage());

    expect(
      screen.getByText('Você ainda não cadastrou nenhum espaço.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '+ Novo espaço' })).toHaveAttribute(
      'href',
      '/painel/espacos/novo',
    );
  });

  it('lists each venue with city, status and number of courts', async () => {
    mocks.apiGet.mockResolvedValue([
      {
        id: ID_A,
        slug: 'arena-central',
        name: 'Arena Central',
        status: 'published',
        city: 'São Paulo',
        fieldsCount: 3,
        coverUrl: 'https://cdn.example.com/capa.jpg',
      },
      {
        id: ID_B,
        slug: 'arena-norte',
        name: 'Arena Norte',
        status: 'draft',
        city: 'Campinas',
        fieldsCount: 1,
        coverUrl: null,
      },
    ]);

    render(await PainelPage());

    const first = screen.getByRole('link', { name: /Arena Central/ });
    expect(first).toHaveAttribute('href', `/painel/espacos/${ID_A}`);
    expect(within(first).getByText('Publicado')).toBeVisible();
    expect(within(first).getByText('São Paulo')).toBeVisible();
    expect(within(first).getByText('3 quadras')).toBeVisible();

    const second = screen.getByRole('link', { name: /Arena Norte/ });
    expect(within(second).getByText('Rascunho')).toBeVisible();
    expect(within(second).getByText('1 quadra')).toBeVisible();
    expect(
      screen.queryByText('Você ainda não cadastrou nenhum espaço.'),
    ).toBeNull();
    expect(screen.getByRole('link', { name: '+ Novo espaço' })).toBeVisible();
  });
});
