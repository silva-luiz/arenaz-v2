import type { Venue } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

import VenuePage from './page';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

const VENUE: Venue = {
  id: ID,
  slug: 'arena-central',
  name: 'Arena Central',
  description: null,
  phone: '+5511987654321',
  address: {
    cep: '01310100',
    street: 'Avenida Paulista',
    number: '1000',
    complement: null,
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  },
  location: { lat: -23.5614, lng: -46.6559 },
  amenities: [],
  cancellationPolicy: 'flexivel',
  timezone: 'America/Sao_Paulo',
  status: 'draft',
  hours: [{ weekday: 1, openMinute: 480, closeMinute: 1320 }],
  photos: [],
  fields: [
    {
      id: FIELD_ID,
      name: 'Quadra 1',
      sports: ['futsal'],
      surface: 'piso_rigido',
      format: null,
      lengthM: null,
      widthM: null,
      minSlotMinutes: 60,
      basePriceCentsPerHour: 18000,
      isActive: true,
      priceRulesCount: 0,
    },
  ],
  createdAt: '2026-10-29T12:00:00.000Z',
  updatedAt: '2026-10-29T12:00:00.000Z',
};

describe('/painel/espacos/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue(VENUE);
  });

  it('loads the venue by id, passing its own path for the sign-in redirect', async () => {
    await VenuePage({ params: Promise.resolve({ id: ID }) });

    expect(mocks.apiGet.mock.calls[0]?.[0]).toBe(`/owner/venues/${ID}`);
    expect(mocks.apiGet.mock.calls[0]?.[2]).toBe(`/painel/espacos/${ID}`);
  });

  it('shows the header, the form, the hours and the courts', async () => {
    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Arena Central' }),
    ).toBeVisible();
    expect(screen.getByText('Rascunho')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeVisible();
    expect(screen.getByLabelText('Nome do espaço')).toHaveValue(
      'Arena Central',
    );
    expect(
      screen.getByRole('button', { name: 'Salvar horário' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /Quadra 1/ })).toHaveAttribute(
      'href',
      `/painel/quadras/${FIELD_ID}`,
    );
    expect(screen.getByRole('link', { name: '+ Nova quadra' })).toHaveAttribute(
      'href',
      `/painel/espacos/${ID}/quadras/novo`,
    );
    expect(
      screen.getByRole('button', { name: 'Excluir espaço' }),
    ).toBeVisible();
  });

  it('shows the published badge and the unpublish action', async () => {
    mocks.apiGet.mockResolvedValue({ ...VENUE, status: 'published' });

    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    expect(screen.getByText('Publicado')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Despublicar' })).toBeVisible();
  });

  it('shows the photo uploader with the venue photos', async () => {
    mocks.apiGet.mockResolvedValue({
      ...VENUE,
      photos: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          url: 'http://localhost:9000/arenaz-photos/a.png',
          position: 0,
        },
      ],
    });

    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    expect(screen.getByLabelText('Adicionar fotos')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Foto 1 do espaço' })).toBeVisible();
    expect(screen.getByText('Capa')).toBeVisible();
  });

  it('says there are no courts yet', async () => {
    mocks.apiGet.mockResolvedValue({ ...VENUE, fields: [] });

    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    expect(screen.getByText('Nenhuma quadra cadastrada.')).toBeVisible();
  });
});

describe('/painel/espacos/[id] public page link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue(VENUE);
  });

  it('offers no public page link while the venue is a draft', async () => {
    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    expect(
      screen.queryByRole('link', { name: /Ver página pública/ }),
    ).toBeNull();
  });

  it('links to the public page, in the same tab, once the venue is published', async () => {
    mocks.apiGet.mockResolvedValue({ ...VENUE, status: 'published' });

    render(await VenuePage({ params: Promise.resolve({ id: ID }) }));

    const link = screen.getByRole('link', { name: 'Ver página pública' });
    expect(link).toHaveAttribute('href', '/espacos/arena-central');
    expect(link).not.toHaveAttribute('target');
  });
});
