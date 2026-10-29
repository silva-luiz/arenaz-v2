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

import { HoursEditor } from './hours-editor';

const VENUE_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

function day(name: string) {
  return screen.getByRole('group', { name });
}

describe('HoursEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });
  });

  it('renders the seven days, Domingo to Sábado', () => {
    render(<HoursEditor venueId={VENUE_ID} initialHours={[]} />);

    const names = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];
    for (const name of names) {
      expect(
        within(day(name)).getByRole('checkbox', { name: 'Aberto' }),
      ).not.toBeChecked();
    }
  });

  it('shows the saved hours, with 1440 as 24:00', () => {
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[{ weekday: 1, openMinute: 480, closeMinute: 1440 }]}
      />,
    );

    const monday = within(day('Segunda'));
    expect(monday.getByRole('checkbox', { name: 'Aberto' })).toBeChecked();
    expect(monday.getByLabelText('Abertura')).toHaveValue('480');
    expect(monday.getByLabelText('Fechamento')).toHaveValue('1440');
    expect(
      within(monday.getByLabelText('Fechamento')).getByRole('option', {
        name: '24:00',
      }),
    ).toBeInTheDocument();
  });

  it('offers times every 30 minutes and hides them while the day is closed', async () => {
    const user = userEvent.setup();
    render(<HoursEditor venueId={VENUE_ID} initialHours={[]} />);

    expect(within(day('Sábado')).queryByLabelText('Abertura')).toBeNull();

    await user.click(
      within(day('Sábado')).getByRole('checkbox', { name: 'Aberto' }),
    );

    const opening = within(day('Sábado')).getByLabelText('Abertura');
    expect(opening).toHaveValue('480');
    expect(within(day('Sábado')).getByLabelText('Fechamento')).toHaveValue(
      '1320',
    );
    // 00:00, 00:30 ... 24:00
    expect(within(opening).getAllByRole('option')).toHaveLength(49);
  });

  it('drops an unchecked day from the payload', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 0, openMinute: 480, closeMinute: 720 },
          { weekday: 1, openMinute: 540, closeMinute: 1080 },
        ]}
      />,
    );

    await user.click(
      within(day('Domingo')).getByRole('checkbox', { name: 'Aberto' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(mocks.apiSend).toHaveBeenCalledTimes(1);
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      unknown,
    ];
    expect(method).toBe('PUT');
    expect(path).toBe(`/owner/venues/${VENUE_ID}/hours`);
    expect(body).toEqual([{ weekday: 1, openMinute: 540, closeMinute: 1080 }]);
  });

  it('saves a day that was just opened with the 08:00-22:00 default', async () => {
    const user = userEvent.setup();
    render(<HoursEditor venueId={VENUE_ID} initialHours={[]} />);

    await user.click(
      within(day('Terça')).getByRole('checkbox', { name: 'Aberto' }),
    );
    await user.selectOptions(
      within(day('Terça')).getByLabelText('Fechamento'),
      '23:30',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(mocks.apiSend.mock.calls[0]?.[2]).toEqual([
      { weekday: 2, openMinute: 480, closeMinute: 1410 },
    ]);
  });

  it('shows the error on the row and does not call the API when closing is not after opening', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 1, openMinute: 480, closeMinute: 1080 },
          { weekday: 3, openMinute: 480, closeMinute: 1080 },
        ]}
      />,
    );

    await user.selectOptions(
      within(day('Quarta')).getByLabelText('Fechamento'),
      '07:00',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(
      within(day('Quarta')).getByText(
        'O fechamento precisa ser depois da abertura',
      ),
    ).toBeVisible();
    expect(within(day('Quarta')).getByLabelText('Fechamento')).toBeInvalid();
    expect(
      within(day('Segunda')).queryByText(
        'O fechamento precisa ser depois da abertura',
      ),
    ).toBeNull();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('announces success and refreshes the server data', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[{ weekday: 1, openMinute: 480, closeMinute: 1080 }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Horário salvo');
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('shows the server error and does not refresh', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: {},
      message: 'Despublique o espaço antes de deixá-lo incompleto',
    });
    const user = userEvent.setup();
    render(<HoursEditor venueId={VENUE_ID} initialHours={[]} />);

    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Despublique o espaço antes de deixá-lo incompleto',
      );
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('puts a server field error on the row it refers to', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: { '1': ['Dia da semana repetido'] },
      message: 'Corrija os campos destacados.',
    });
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 1, openMinute: 480, closeMinute: 1080 },
          { weekday: 4, openMinute: 480, closeMinute: 1080 },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(
      await within(day('Quinta')).findByText('Dia da semana repetido'),
    ).toBeVisible();
  });
});

function interval(weekday: string, number: number) {
  return within(
    within(day(weekday)).getByRole('group', {
      name: `Intervalo ${String(number)}`,
    }),
  );
}

function payload(): unknown {
  return (mocks.apiSend.mock.calls[0] as unknown[] | undefined)?.[2];
}

describe('HoursEditor with several intervals per day', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });
  });

  it('shows each saved interval of a day, earliest first', () => {
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 5, openMinute: 1020, closeMinute: 1440 },
          { weekday: 5, openMinute: 480, closeMinute: 720 },
        ]}
      />,
    );

    expect(interval('Sexta', 1).getByLabelText('Abertura')).toHaveValue('480');
    expect(interval('Sexta', 1).getByLabelText('Fechamento')).toHaveValue(
      '720',
    );
    expect(interval('Sexta', 2).getByLabelText('Abertura')).toHaveValue('1020');
    expect(interval('Sexta', 2).getByLabelText('Fechamento')).toHaveValue(
      '1440',
    );
  });

  it('adds an interval after the last one and saves both', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[{ weekday: 5, openMinute: 480, closeMinute: 720 }]}
      />,
    );

    expect(
      within(day('Sexta')).queryByRole('button', { name: /^Remover/ }),
    ).toBeNull();
    await user.click(
      screen.getByRole('button', { name: '+ Intervalo (Sexta)' }),
    );

    expect(interval('Sexta', 2).getByLabelText('Abertura')).toHaveValue('720');
    await user.selectOptions(
      interval('Sexta', 2).getByLabelText('Fechamento'),
      '23:00',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(payload()).toEqual([
      { weekday: 5, openMinute: 480, closeMinute: 720 },
      { weekday: 5, openMinute: 720, closeMinute: 1380 },
    ]);
  });

  it('removes an interval by its own button, named after the day', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 5, openMinute: 480, closeMinute: 720 },
          { weekday: 5, openMinute: 1020, closeMinute: 1320 },
        ]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Remover intervalo 1 de Sexta' }),
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(payload()).toEqual([
      { weekday: 5, openMinute: 1020, closeMinute: 1320 },
    ]);
    expect(
      within(day('Sexta')).queryByRole('button', { name: /^Remover/ }),
    ).toBeNull();
  });

  it('flags overlapping intervals on the later one and does not call the API', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 5, openMinute: 480, closeMinute: 720 },
          { weekday: 5, openMinute: 660, closeMinute: 900 },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(
      interval('Sexta', 2).getByText('Horários se sobrepõem'),
    ).toBeVisible();
    expect(interval('Sexta', 2).getByLabelText('Abertura')).toBeInvalid();
    expect(
      interval('Sexta', 1).queryByText('Horários se sobrepõem'),
    ).toBeNull();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('"Vira a madrugada até" closes at 24:00 and creates the next-day interval', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[{ weekday: 5, openMinute: 1080, closeMinute: 1320 }]}
      />,
    );

    await user.selectOptions(
      interval('Sexta', 1).getByLabelText('Vira a madrugada até'),
      '03:00',
    );

    expect(interval('Sexta', 1).getByLabelText('Fechamento')).toHaveValue(
      '1440',
    );
    expect(
      within(day('Sábado')).getByRole('checkbox', { name: 'Aberto' }),
    ).toBeChecked();
    expect(interval('Sábado', 1).getByLabelText('Abertura')).toHaveValue('0');
    expect(interval('Sábado', 1).getByLabelText('Fechamento')).toHaveValue(
      '180',
    );

    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));
    expect(payload()).toEqual([
      { weekday: 5, openMinute: 1080, closeMinute: 1440 },
      { weekday: 6, openMinute: 0, closeMinute: 180 },
    ]);
  });

  it('the madrugada shortcut on Saturday wraps to Sunday and reuses a 00:00 interval', async () => {
    const user = userEvent.setup();
    render(
      <HoursEditor
        venueId={VENUE_ID}
        initialHours={[
          { weekday: 0, openMinute: 0, closeMinute: 60 },
          { weekday: 0, openMinute: 600, closeMinute: 900 },
          { weekday: 6, openMinute: 1080, closeMinute: 1320 },
        ]}
      />,
    );

    await user.selectOptions(
      interval('Sábado', 1).getByLabelText('Vira a madrugada até'),
      '02:00',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar horário' }));

    expect(payload()).toEqual([
      { weekday: 0, openMinute: 0, closeMinute: 120 },
      { weekday: 0, openMinute: 600, closeMinute: 900 },
      { weekday: 6, openMinute: 1080, closeMinute: 1440 },
    ]);
  });

  it('does not offer more than 21 intervals', () => {
    const hours = Array.from({ length: 21 }, (_, i) => ({
      weekday: i % 7,
      openMinute: Math.floor(i / 7) * 480,
      closeMinute: Math.floor(i / 7) * 480 + 240,
    }));
    render(<HoursEditor venueId={VENUE_ID} initialHours={hours} />);

    expect(
      screen.getByRole('button', { name: '+ Intervalo (Sexta)' }),
    ).toBeDisabled();
  });
});
