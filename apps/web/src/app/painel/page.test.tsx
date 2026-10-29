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
        coverSrcSet: 'https://cdn.example.com/capa.w400.webp 400w',
      },
      {
        id: ID_B,
        slug: 'arena-norte',
        name: 'Arena Norte',
        status: 'draft',
        city: 'Campinas',
        fieldsCount: 1,
        coverUrl: null,
        coverSrcSet: null,
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

  it('shows the cover when there is one and a logo tile when there is not', async () => {
    mocks.apiGet.mockResolvedValue([
      {
        id: ID_A,
        slug: 'arena-central',
        name: 'Arena Central',
        status: 'published',
        city: 'São Paulo',
        fieldsCount: 3,
        coverUrl: 'https://cdn.example.com/capa.jpg',
        coverSrcSet: 'https://cdn.example.com/capa.w400.webp 400w',
      },
      {
        id: ID_B,
        slug: 'arena-norte',
        name: 'Arena Norte',
        status: 'draft',
        city: 'Campinas',
        fieldsCount: 0,
        coverUrl: null,
        coverSrcSet: null,
      },
    ]);

    render(await PainelPage());

    const first = screen.getByRole('link', { name: /Arena Central/ });
    const cover = first.querySelector('img');
    expect(cover).toHaveAttribute('src', 'https://cdn.example.com/capa.jpg');
    expect(cover).toHaveAttribute(
      'srcset',
      'https://cdn.example.com/capa.w400.webp 400w',
    );
    // The painel grid: 1 column, 2 from 480px, 3 from lg, 4 from xl.
    expect(cover).toHaveAttribute(
      'sizes',
      '(min-width: 1360px) 302px, (min-width: 1280px) calc(25vw - 38px), (min-width: 1024px) calc(33vw - 43px), (min-width: 480px) calc(50vw - 28px), calc(100vw - 32px)',
    );
    expect(cover).toHaveAttribute('loading', 'lazy');
    expect(within(first).queryByTestId('owner-venue-fallback')).toBeNull();
    const second = screen.getByRole('link', { name: /Arena Norte/ });
    expect(second.querySelector('img')).toBeNull();
    expect(within(second).getByTestId('owner-venue-fallback')).toBeVisible();
    expect(within(second).getByText('0 quadras')).toBeVisible();
  });
});
