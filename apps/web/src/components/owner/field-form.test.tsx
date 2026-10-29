import type { FieldResponse } from '@arenaz/contracts';
import { act, render, screen, waitFor } from '@testing-library/react';
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

import { FieldForm } from './field-form';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

const FIELD: FieldResponse = {
  id: '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21',
  venueId: VENUE_ID,
  name: 'Quadra 1',
  sports: ['futsal', 'padel'],
  surface: 'piso_rigido',
  format: '5x5',
  lengthM: 28,
  widthM: 15.5,
  minSlotMinutes: 90,
  basePriceCentsPerHour: 18000,
  isActive: true,
  priceRules: [],
  blocks: [],
};

describe('FieldForm (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts empty, with 60 minutes and an active court', () => {
    render(<FieldForm venueId={VENUE_ID} />);

    expect(screen.getByLabelText('Nome da quadra')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Futsal' })).not.toBeChecked();
    expect(screen.getByLabelText('Piso')).toHaveDisplayValue('Selecione');
    expect(screen.getByLabelText('Formato')).toHaveDisplayValue('Sem formato');
    expect(screen.getByLabelText('Duração mínima')).toHaveDisplayValue(
      '60 minutos',
    );
    expect(screen.getByLabelText('Preço base por hora')).toHaveValue('');
    expect(
      screen.getByRole('checkbox', { name: 'Quadra ativa' }),
    ).toBeChecked();
  });

  it('lists the catalog: sports, floors, formats and slot lengths', () => {
    render(<FieldForm venueId={VENUE_ID} />);

    expect(
      screen.getByRole('checkbox', { name: 'Beach tennis' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(9);
    expect(
      screen.getByRole('option', { name: 'Grama sintética' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '11x11' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '30 minutos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '90 minutos' }),
    ).toBeInTheDocument();
  });

  it('does not call the API when the form is invalid', async () => {
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    expect(
      await screen.findByText('O nome precisa ter pelo menos 2 caracteres'),
    ).toBeVisible();
    expect(screen.getByText('Selecione pelo menos um esporte')).toBeVisible();
    expect(screen.getByText('Selecione o piso')).toBeVisible();
    expect(screen.getByText('Informe o preço por hora')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('does not send an invalid price', async () => {
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Preço base por hora'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    expect(await screen.findByText('Valor inválido')).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('creates the court with the price in cents and goes to its page', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: FIELD });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Nome da quadra'), '  Quadra 1 ');
    await user.click(screen.getByRole('checkbox', { name: 'Futsal' }));
    await user.click(screen.getByRole('checkbox', { name: 'Padel' }));
    await user.selectOptions(screen.getByLabelText('Piso'), 'Piso rígido');
    await user.type(
      screen.getByLabelText('Preço base por hora'),
      'R$ 1.234,50',
    );
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(`/painel/quadras/${FIELD.id}`);
    });
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      unknown,
    ];
    expect(method).toBe('POST');
    expect(path).toBe(`/owner/venues/${VENUE_ID}/fields`);
    expect(body).toEqual({
      name: 'Quadra 1',
      sports: ['futsal', 'padel'],
      surface: 'piso_rigido',
      format: null,
      minSlotMinutes: 60,
      basePriceCentsPerHour: 123450,
      isActive: true,
    });
  });

  it('sends the format, the measures in meters and the slot length when given', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: FIELD });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Nome da quadra'), 'Quadra 2');
    await user.click(screen.getByRole('checkbox', { name: 'Society' }));
    await user.selectOptions(screen.getByLabelText('Piso'), 'Grama sintética');
    await user.selectOptions(screen.getByLabelText('Formato'), '7x7');
    await user.type(screen.getByLabelText('Comprimento (m)'), '40');
    await user.type(screen.getByLabelText('Largura (m)'), '20,5');
    await user.selectOptions(
      screen.getByLabelText('Duração mínima'),
      '30 minutos',
    );
    await user.type(screen.getByLabelText('Preço base por hora'), '200');
    await user.click(screen.getByRole('checkbox', { name: 'Quadra ativa' }));
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[2]).toEqual({
      name: 'Quadra 2',
      sports: ['futebol_society'],
      surface: 'grama_sintetica',
      format: '7x7',
      lengthM: 40,
      widthM: 20.5,
      minSlotMinutes: 30,
      basePriceCentsPerHour: 20000,
      isActive: false,
    });
  });

  it('leaves empty measures out when creating', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: FIELD });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Nome da quadra'), 'Quadra 3');
    await user.click(screen.getByRole('checkbox', { name: 'Futsal' }));
    await user.selectOptions(screen.getByLabelText('Piso'), 'Areia');
    await user.type(screen.getByLabelText('Preço base por hora'), '100');
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    const body = mocks.apiSend.mock.calls[0]?.[2] as Record<string, unknown>;
    expect('lengthM' in body).toBe(false);
    expect('widthM' in body).toBe(false);
  });

  it('disables the controls while the court is being saved', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mocks.apiSend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    await user.click(screen.getByRole('button', { name: /Salvar alterações/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('Nome da quadra')).toBeDisabled();
    });
    expect(screen.getByLabelText('Preço base por hora')).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Futsal' })).toBeDisabled();

    await act(async () => {
      answer({ ok: true, data: FIELD });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Nome da quadra')).toBeEnabled();
    });
  });

  it('flags a measure that is not a number', async () => {
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Comprimento (m)'), 'longa');
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    expect(await screen.findByText('Medida inválida')).toBeVisible();
    expect(screen.getByLabelText('Comprimento (m)')).toBeInvalid();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('shows the server error and stays on the page', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: { name: ['O nome precisa ter pelo menos 2 caracteres'] },
      message: 'Corrija os campos destacados.',
    });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} />);

    await user.type(screen.getByLabelText('Nome da quadra'), 'Quadra 1');
    await user.click(screen.getByRole('checkbox', { name: 'Futsal' }));
    await user.selectOptions(screen.getByLabelText('Piso'), 'Areia');
    await user.type(screen.getByLabelText('Preço base por hora'), '100');
    await user.click(screen.getByRole('button', { name: 'Criar quadra' }));

    expect(
      await screen.findByText('O nome precisa ter pelo menos 2 caracteres'),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe('FieldForm (edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is filled with the court', () => {
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    expect(screen.getByLabelText('Nome da quadra')).toHaveValue('Quadra 1');
    expect(screen.getByRole('checkbox', { name: 'Futsal' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Padel' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tênis' })).not.toBeChecked();
    expect(screen.getByLabelText('Piso')).toHaveDisplayValue('Piso rígido');
    expect(screen.getByLabelText('Formato')).toHaveDisplayValue('5x5');
    expect(screen.getByLabelText('Comprimento (m)')).toHaveValue('28');
    expect(screen.getByLabelText('Largura (m)')).toHaveValue('15,5');
    expect(screen.getByLabelText('Duração mínima')).toHaveDisplayValue(
      '90 minutos',
    );
    expect(screen.getByLabelText('Preço base por hora')).toHaveValue(
      'R$ 180,00',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Quadra ativa' }),
    ).toBeChecked();
  });

  it('saves with PATCH, announces it and refreshes', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...FIELD, name: 'Quadra Central' },
    });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    const name = screen.getByLabelText('Nome da quadra');
    await user.clear(name);
    await user.type(name, 'Quadra Central');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Quadra salva');
    });
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(method).toBe('PATCH');
    expect(path).toBe(`/owner/fields/${FIELD.id}`);
    expect(body).toEqual({
      name: 'Quadra Central',
      sports: ['futsal', 'padel'],
      surface: 'piso_rigido',
      format: '5x5',
      lengthM: 28,
      widthM: 15.5,
      minSlotMinutes: 90,
      basePriceCentsPerHour: 18000,
      isActive: true,
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('sends null for measures that were cleared, so the server clears them too', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...FIELD, lengthM: null, widthM: null },
    });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    await user.clear(screen.getByLabelText('Comprimento (m)'));
    await user.clear(screen.getByLabelText('Largura (m)'));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[2]).toMatchObject({
      lengthM: null,
      widthM: null,
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Comprimento (m)')).toHaveValue('');
    });
  });

  it('turns the format off with null', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...FIELD, format: null },
    });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    await user.selectOptions(screen.getByLabelText('Formato'), 'Sem formato');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[2]).toMatchObject({ format: null });
  });

  it('shows the server detail when deactivating would leave a published venue incomplete', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: {},
      message: 'Despublique o espaço antes de deixá-lo incompleto',
    });
    const user = userEvent.setup();
    render(<FieldForm venueId={VENUE_ID} field={FIELD} />);

    await user.click(screen.getByRole('checkbox', { name: 'Quadra ativa' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Despublique o espaço antes de deixá-lo incompleto',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
