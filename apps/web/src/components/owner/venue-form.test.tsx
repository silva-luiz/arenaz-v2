import type { Venue } from '@arenaz/contracts';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
// Leaflet needs a real browser; the numeric fields are the tested surface.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

import { VenueForm } from './venue-form';

const CEP_OK = {
  ok: true,
  data: {
    cep: '01310100',
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    location: { lat: -23.5614, lng: -46.6559 },
  },
};

const VENUE: Venue = {
  id: '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10',
  slug: 'arena-central',
  name: 'Arena Central',
  description: 'Quadras cobertas',
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
  amenities: ['bar', 'wifi'],
  cancellationPolicy: 'moderada',
  timezone: 'America/Sao_Paulo',
  status: 'draft',
  hours: [],
  photos: [],
  fields: [],
  createdAt: '2026-10-29T12:00:00.000Z',
  updatedAt: '2026-10-29T12:00:00.000Z',
};

function cepCalls() {
  return mocks.apiSend.mock.calls.filter(
    (call) => typeof call[1] === 'string' && call[1].startsWith('/geo/cep/'),
  );
}

describe('VenueForm (create)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('looks the CEP up on blur and fills the address and the pin', async () => {
    mocks.apiSend.mockResolvedValue(CEP_OK);
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '01310-100');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });
    expect(mocks.apiSend.mock.calls[0]?.slice(0, 2)).toEqual([
      'GET',
      '/geo/cep/01310100',
    ]);
    expect(screen.getByLabelText('Bairro')).toHaveValue('Bela Vista');
    expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    expect(screen.getByLabelText('UF')).toHaveValue('SP');
    expect(screen.getByLabelText('Latitude')).toHaveValue('-23.5614');
    expect(screen.getByLabelText('Longitude')).toHaveValue('-46.6559');
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100');
  });

  it('leaves the pin to the owner when the CEP has no coordinates', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...CEP_OK.data, location: null },
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });
    expect(screen.getByLabelText('Latitude')).toHaveValue('');
    expect(screen.getByLabelText('Longitude')).toHaveValue('');
  });

  it('keeps what the owner typed when the CEP lookup returns an empty street', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...CEP_OK.data, street: '' },
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByLabelText('Cidade')).toHaveValue('São Paulo');
    });
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua das Flores');
  });

  it('shows "CEP não encontrado" on the CEP field', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 404,
      fieldErrors: {},
      message: 'CEP não encontrado',
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '99999999');
    await user.tab();

    expect(await screen.findByText('CEP não encontrado')).toBeVisible();
    expect(screen.getByLabelText('CEP')).toBeInvalid();
  });

  it('shows the service detail when the CEP service is down', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 503,
      fieldErrors: {},
      message: 'Serviço de CEP indisponível, tente de novo',
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();

    expect(
      await screen.findByText('Serviço de CEP indisponível, tente de novo'),
    ).toBeVisible();
  });

  it('clears the lookup error when the owner edits the CEP', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 404,
      fieldErrors: {},
      message: 'CEP não encontrado',
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '99999999');
    await user.tab();
    await screen.findByText('CEP não encontrado');
    await user.type(screen.getByLabelText('CEP'), '1');

    expect(screen.queryByText('CEP não encontrado')).toBeNull();
  });

  it('does not call the lookup for an incomplete CEP or the same CEP twice', async () => {
    mocks.apiSend.mockResolvedValue(CEP_OK);
    const user = userEvent.setup();
    render(<VenueForm />);
    const cep = screen.getByLabelText('CEP');

    await user.type(cep, '0131');
    await user.tab();
    expect(cepCalls()).toHaveLength(0);

    await user.clear(cep);
    await user.type(cep, '01310100');
    await user.tab();
    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });
    await user.click(cep);
    await user.tab();

    expect(cepCalls()).toHaveLength(1);
  });

  it('ignores a lookup that comes back after the CEP was edited', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mocks.apiSend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();
    await user.type(screen.getByLabelText('CEP'), '9');
    await act(async () => {
      answer(CEP_OK);
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Rua')).toHaveValue('');
    expect(screen.getByLabelText('Latitude')).toHaveValue('');
  });

  it('does not call the API when the form is invalid', async () => {
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

    expect(
      await screen.findByText('O nome precisa ter pelo menos 3 caracteres'),
    ).toBeVisible();
    expect(screen.getByText('Informe a rua')).toBeVisible();
    expect(screen.getByText('Selecione o estado')).toBeVisible();
    expect(screen.getByText('Informe a localização do espaço')).toBeVisible();
    expect(
      screen.getByText('Selecione a política de cancelamento'),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('creates the venue and goes to its page', async () => {
    mocks.apiSend.mockImplementation((method: string, path: string) => {
      if (path.startsWith('/geo/cep/')) return Promise.resolve(CEP_OK);
      if (method === 'POST') return Promise.resolve({ ok: true, data: VENUE });
      return Promise.reject(new Error(`unexpected ${method} ${path}`));
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(
      screen.getByLabelText('Nome do espaço'),
      '  Arena Central ',
    );
    await user.type(screen.getByLabelText('Telefone'), '(11) 98765-4321');
    await user.type(screen.getByLabelText('CEP'), '01310-100');
    await user.tab();
    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });
    await user.type(screen.getByLabelText('Número'), '1000');
    await user.click(screen.getByRole('checkbox', { name: 'Vestiário' }));
    await user.click(screen.getByRole('checkbox', { name: 'Bar' }));
    await user.click(screen.getByRole('radio', { name: 'Flexível' }));
    await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(`/painel/espacos/${VENUE.id}`);
    });
    const post = mocks.apiSend.mock.calls.find((call) => call[0] === 'POST');
    expect(post?.[1]).toBe('/owner/venues');
    expect(post?.[2]).toEqual({
      name: 'Arena Central',
      phone: '+5511987654321',
      address: {
        cep: '01310100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
      },
      location: { lat: -23.5614, lng: -46.6559 },
      amenities: ['vestiario', 'bar'],
      cancellationPolicy: 'flexivel',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('shows the server error and stays on the page', async () => {
    mocks.apiSend.mockImplementation((method: string, path: string) => {
      if (path.startsWith('/geo/cep/')) return Promise.resolve(CEP_OK);
      return Promise.resolve({
        ok: false,
        status: 422,
        fieldErrors: { name: ['O nome precisa ter pelo menos 3 caracteres'] },
        message: 'Corrija os campos destacados.',
      });
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('Nome do espaço'), 'Arena');
    await user.type(screen.getByLabelText('Telefone'), '11987654321');
    await user.type(screen.getByLabelText('CEP'), '01310100');
    await user.tab();
    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Avenida Paulista');
    });
    await user.type(screen.getByLabelText('Número'), '1');
    await user.click(screen.getByRole('radio', { name: 'Rígida' }));
    await user.click(screen.getByRole('button', { name: 'Criar espaço' }));

    expect(
      await screen.findByText('O nome precisa ter pelo menos 3 caracteres'),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('lists the catalog amenities and cancellation policies with descriptions', () => {
    render(<VenueForm />);

    expect(
      screen.getByRole('checkbox', { name: 'Aluguel de material' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Moderada' })).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'Moderada' }),
    ).toHaveAccessibleDescription('Reembolso total até 48h antes');
  });
});

describe('VenueForm (edit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is filled with the venue, formatted for display', () => {
    render(<VenueForm venue={VENUE} />);

    expect(screen.getByLabelText('Nome do espaço')).toHaveValue(
      'Arena Central',
    );
    expect(screen.getByLabelText('Descrição')).toHaveValue('Quadras cobertas');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98765-4321');
    expect(screen.getByLabelText('CEP')).toHaveValue('01310-100');
    expect(screen.getByLabelText('UF')).toHaveValue('SP');
    expect(screen.getByLabelText('Latitude')).toHaveValue('-23.5614');
    expect(screen.getByRole('checkbox', { name: 'Bar' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Wi-Fi' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Chuveiro' }),
    ).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Moderada' })).toBeChecked();
  });

  it('focuses the latitude field when the location is the invalid part', async () => {
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    await user.clear(screen.getByLabelText('Latitude'));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText('Informe a localização do espaço'),
    ).toBeVisible();
    expect(screen.getByLabelText('Latitude')).toHaveFocus();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('does not look the CEP up again when it was not changed', async () => {
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    await user.click(screen.getByLabelText('CEP'));
    await user.tab();

    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('does not look the CEP up again when the owner types a digit and takes it back', async () => {
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    const cep = screen.getByLabelText('CEP');
    await user.click(cep);
    await user.keyboard('9');
    await user.keyboard('{Backspace}');
    await user.tab();

    expect(cep).toHaveValue('01310-100');
    expect(cepCalls()).toHaveLength(0);
  });

  it('keeps a pin moved by hand when the CEP is typed again to the same value', async () => {
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    const latitude = screen.getByLabelText('Latitude');
    await user.clear(latitude);
    await user.type(latitude, '-23.5');
    const cep = screen.getByLabelText('CEP');
    await user.type(cep, '1');
    await user.keyboard('{Backspace}');
    await user.tab();

    expect(cepCalls()).toHaveLength(0);
    expect(latitude).toHaveValue('-23.5');
  });

  it('looks up a different complete CEP in edit mode', async () => {
    mocks.apiSend.mockResolvedValue({
      ...CEP_OK,
      data: { ...CEP_OK.data, cep: '20040020', street: 'Rua da Assembleia' },
    });
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    const cep = screen.getByLabelText('CEP');
    await user.clear(cep);
    await user.type(cep, '20040020');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByLabelText('Rua')).toHaveValue('Rua da Assembleia');
    });
    expect(cepCalls()).toHaveLength(1);
  });

  it('saves with PATCH, announces it and refreshes', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...VENUE, name: 'Arena Nova' },
    });
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    const name = screen.getByLabelText('Nome do espaço');
    await user.clear(name);
    await user.type(name, 'Arena Nova');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Espaço salvo');
    });
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      { name: string; phone: string },
    ];
    expect(method).toBe('PATCH');
    expect(path).toBe(`/owner/venues/${VENUE.id}`);
    expect(body.name).toBe('Arena Nova');
    expect(body.phone).toBe('+5511987654321');
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows the server detail, for example when a published venue would turn incomplete', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: {},
      message: 'Despublique o espaço antes de deixá-lo incompleto',
    });
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Despublique o espaço antes de deixá-lo incompleto',
      );
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe('VenueForm time zone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers the Brazilian zones with pt-BR labels, Brasília first and selected', () => {
    render(<VenueForm />);

    const select = screen.getByLabelText('Fuso horário');
    expect(select).toHaveValue('America/Sao_Paulo');
    const labels = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels).toHaveLength(16);
    expect(labels[0]).toBe('Horário de Brasília');
    expect(labels).toContain('Amazonas (UTC−4)');
  });

  it('follows the UF until the owner picks a zone by hand', async () => {
    const user = userEvent.setup();
    render(<VenueForm />);
    const zone = screen.getByLabelText('Fuso horário');

    await user.selectOptions(screen.getByLabelText('UF'), 'AM');
    expect(zone).toHaveValue('America/Manaus');
    await user.selectOptions(screen.getByLabelText('UF'), 'AC');
    expect(zone).toHaveValue('America/Rio_Branco');

    await user.selectOptions(zone, 'America/Noronha');
    await user.selectOptions(screen.getByLabelText('UF'), 'BA');
    expect(zone).toHaveValue('America/Noronha');
  });

  it('follows the state filled in by the CEP lookup', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...CEP_OK.data, city: 'Manaus', state: 'AM' },
    });
    const user = userEvent.setup();
    render(<VenueForm />);

    await user.type(screen.getByLabelText('CEP'), '69000-000');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByLabelText('UF')).toHaveValue('AM');
    });
    expect(screen.getByLabelText('Fuso horário')).toHaveValue('America/Manaus');
  });

  it('edit: shows the saved zone and follows the UF only if it was the default', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<VenueForm venue={VENUE} />);
    expect(screen.getByLabelText('Fuso horário')).toHaveValue(
      'America/Sao_Paulo',
    );
    await user.selectOptions(screen.getByLabelText('UF'), 'AM');
    expect(screen.getByLabelText('Fuso horário')).toHaveValue('America/Manaus');
    unmount();

    render(<VenueForm venue={{ ...VENUE, timezone: 'America/Noronha' }} />);
    expect(screen.getByLabelText('Fuso horário')).toHaveValue(
      'America/Noronha',
    );
    await user.selectOptions(screen.getByLabelText('UF'), 'AM');
    expect(screen.getByLabelText('Fuso horário')).toHaveValue(
      'America/Noronha',
    );
  });

  it('edit: saves the chosen zone', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...VENUE, timezone: 'America/Manaus' },
    });
    const user = userEvent.setup();
    render(<VenueForm venue={VENUE} />);

    await user.selectOptions(
      screen.getByLabelText('Fuso horário'),
      'America/Manaus',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    const patch = mocks.apiSend.mock.calls.find((call) => call[0] === 'PATCH');
    expect(patch?.[2]).toMatchObject({ timezone: 'America/Manaus' });
  });
});
