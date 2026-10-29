import type { FieldResponse } from '@arenaz/contracts';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({ apiGet: mocks.apiGet }));
vi.mock('@/lib/api-client', () => ({ apiSend: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import QuadraPage from './page';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

const FIELD: FieldResponse = {
  id: FIELD_ID,
  venueId: VENUE_ID,
  name: 'Quadra 1',
  sports: ['futsal'],
  surface: 'piso_rigido',
  format: null,
  lengthM: null,
  widthM: null,
  minSlotMinutes: 60,
  basePriceCentsPerHour: 18000,
  isActive: true,
  priceRules: [],
  blocks: [],
};

describe('/painel/quadras/[fieldId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiGet.mockResolvedValue(FIELD);
  });

  it('loads the field by id, passing its own path for the sign-in redirect', async () => {
    await QuadraPage({ params: Promise.resolve({ fieldId: FIELD_ID }) });

    expect(mocks.apiGet.mock.calls[0]?.[0]).toBe(`/owner/fields/${FIELD_ID}`);
    expect(mocks.apiGet.mock.calls[0]?.[2]).toBe(`/painel/quadras/${FIELD_ID}`);
  });

  it('shows the court, its prices, its blocks and the delete action', async () => {
    render(
      await QuadraPage({ params: Promise.resolve({ fieldId: FIELD_ID }) }),
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadra 1' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Voltar ao espaço/ }),
    ).toHaveAttribute('href', `/painel/espacos/${VENUE_ID}`);
    expect(screen.getByLabelText('Nome da quadra')).toHaveValue('Quadra 1');
    expect(screen.getByRole('button', { name: '+ Faixa' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Bloquear período' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Excluir quadra' }),
    ).toBeVisible();
  });
});
