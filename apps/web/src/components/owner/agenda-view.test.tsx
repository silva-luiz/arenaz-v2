import type { AgendaItem, OwnerAgenda } from '@arenaz/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
  demo: { value: false },
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn() }),
}));
vi.mock('@/lib/demo', () => ({
  get isDemoMode() {
    return mocks.demo.value;
  },
}));

import { AgendaView } from './agenda-view';

const FIELD_1 = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';
const FIELD_2 = '9b2e7d45-3a1c-4c63-9e76-6d8a3a7a0b32';
const BOOKING_ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
const MANUAL_ID = '4a1d2c3e-7b5f-4e7c-8b63-2c7f1d8e0a21';
const BLOCK_ID = '5b2e3d4f-8c6a-4f8d-9c74-3d8a2e9f1b32';

const HOURS = [{ weekday: 1, openMinute: 17 * 60, closeMinute: 23 * 60 }];

// 2026-11-02 is a Monday. 21:00Z is 18:00 in São Paulo.
const APP_BOOKING: AgendaItem = {
  kind: 'booking',
  id: BOOKING_ID,
  startsAt: '2026-11-02T21:00:00.000Z',
  endsAt: '2026-11-02T23:00:00.000Z',
  status: 'confirmed',
  origin: 'app',
  customerName: 'Ana S.',
  customerPhone: null,
  totalCents: 36000,
};
const MANUAL_BOOKING: AgendaItem = {
  kind: 'booking',
  id: MANUAL_ID,
  startsAt: '2026-11-03T00:00:00.000Z',
  endsAt: '2026-11-03T01:00:00.000Z',
  status: 'confirmed',
  origin: 'manual',
  customerName: 'Escolinha',
  customerPhone: '+5511987654321',
  totalCents: 18000,
};
const BLOCK: AgendaItem = {
  kind: 'block',
  id: BLOCK_ID,
  startsAt: '2026-11-02T20:00:00.000Z',
  endsAt: '2026-11-02T21:00:00.000Z',
  reason: 'Manutenção',
};

function agenda(timezone: OwnerAgenda['timezone'] = 'America/Sao_Paulo') {
  return {
    date: '2026-11-02',
    timezone,
    fields: [
      {
        id: FIELD_1,
        name: 'Quadra 1',
        isActive: true,
        items: [APP_BOOKING, BLOCK],
      },
      {
        id: FIELD_2,
        name: 'Quadra 2',
        isActive: true,
        items: [MANUAL_BOOKING],
      },
    ],
  } satisfies OwnerAgenda;
}

function inGrid() {
  return within(
    document.querySelector<HTMLElement>('[data-agenda="grid"]') as HTMLElement,
  );
}

function renderView(data: OwnerAgenda = agenda()) {
  return render(
    <AgendaView
      date={data.date}
      today="2026-11-02"
      timezone={data.timezone}
      fields={data.fields}
      hours={HOURS}
    />,
  );
}

describe('AgendaView (wide)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demo.value = false;
  });

  it('names the courts with level 2 headings, like the agenda section', () => {
    renderView();

    // The page has the only h1; the section and the court headings are h2,
    // never a h3 that would skip a level.
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Agenda' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('heading', { level: 2, name: 'Quadra 1' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('heading', { level: 2, name: 'Quadra 2' }).length,
    ).toBeGreaterThan(0);
  });

  it('puts the actions beside the intro and the indicators under it', () => {
    render(
      <AgendaView
        date="2026-11-02"
        today="2026-11-02"
        timezone="America/Sao_Paulo"
        fields={agenda().fields}
        hours={HOURS}
        intro={<h1>Boa noite, Marcos</h1>}
        indicators={<p>Ocupação hoje</p>}
        dayNav={<nav aria-label="Dia da agenda" />}
      />,
    );
    const heading = screen.getByRole('heading', { level: 1 });
    const manual = screen.getByRole('button', { name: '+ Reserva manual' });
    const indicators = screen.getByText('Ocupação hoje');
    const section = screen.getByRole('region', { name: 'Agenda' });
    // Document order: intro, actions, indicators, agenda.
    expect(
      heading.compareDocumentPosition(manual) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      manual.compareDocumentPosition(indicators) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(section).getByRole('navigation', { name: 'Dia da agenda' }),
    ).toBeInTheDocument();
    expect(section).toHaveAttribute('id', 'agenda');
  });

  it('is a table with a row per court and the hours as columns', () => {
    renderView();
    const table = screen.getByRole('table', { name: /agenda/i });
    expect(
      within(table).getByRole('rowheader', { name: 'Quadra 1' }),
    ).toHaveAttribute('scope', 'row');
    expect(
      within(table).getByRole('rowheader', { name: 'Quadra 2' }),
    ).toBeVisible();
    // 17:00-23:00: six hours of two 30-minute columns each.
    const hours = within(table)
      .getAllByRole('columnheader')
      .filter((header) => /h$/.test(header.textContent));
    expect(hours.map((header) => header.textContent)).toEqual([
      '17h',
      '18h',
      '19h',
      '20h',
      '21h',
      '22h',
    ]);
    expect(
      within(table).getByRole('columnheader', { name: '18h' }),
    ).toHaveAttribute('colspan', '2');
  });

  it('puts each item in the right cell, in the time of the venue', () => {
    renderView();
    const court1 = screen
      .getByRole('rowheader', { name: 'Quadra 1' })
      .closest('tr') as HTMLElement;
    const booking = within(court1).getByRole('button', {
      name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
    });
    const cell = booking.closest('td');
    // Four 30-minute columns, right after the 17:00-18:00 block (two).
    expect(cell).toHaveAttribute('colspan', '4');
    expect(cell).toBe(court1.querySelectorAll('td')[1]);
    expect(court1.querySelectorAll('td')[0]).toHaveAttribute('colspan', '2');

    const court2 = screen
      .getByRole('rowheader', { name: 'Quadra 2' })
      .closest('tr') as HTMLElement;
    const manual = within(court2).getByRole('button', {
      name: 'Quadra 2, 21:00–22:00, reserva de Escolinha, manual, confirmada',
    });
    // 17:00 to 21:00 free: eight empty cells before it.
    const cells = [...court2.querySelectorAll('td')];
    expect(cells.indexOf(manual.closest('td') as HTMLTableCellElement)).toBe(8);
  });

  it('shows who and when on each item, colored by its origin', () => {
    renderView();
    const app = inGrid().getByRole('button', {
      name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
    });
    expect(app).toHaveTextContent('Ana S.');
    expect(app).toHaveTextContent('18:00–20:00');
    expect(app.className).toContain('bg-[#DDF0E5]');
    const manual = inGrid().getByRole('button', {
      name: /reserva de Escolinha, manual/,
    });
    expect(manual.className).toContain('bg-[#F2F2F2]');
  });

  it('shows the same instant on the wall clock of another zone', () => {
    renderView(agenda('America/Manaus'));
    // 21:00Z is 17:00 in Manaus.
    expect(
      inGrid().getByRole('button', {
        name: 'Quadra 1, 17:00–19:00, reserva de Ana S., pelo app, confirmada',
      }),
    ).toBeVisible();
  });

  it('marks blocks with text and a legend of the types that exist', () => {
    renderView();
    expect(
      inGrid().getByRole('button', {
        name: 'Quadra 1, 17:00–18:00, bloqueio, Manutenção',
      }),
    ).toBeVisible();
    const legend = screen.getByRole('list', { name: 'Legenda' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Pelo app', 'Manual', 'Bloqueio', 'Aguardando pagamento']);
  });

  it('adds Mensalista and Partida aberta to the legend only in the demo, with no items', () => {
    mocks.demo.value = true;
    renderView();
    const legend = screen.getByRole('list', { name: 'Legenda' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Pelo app',
      'Mensalista',
      'Manual',
      'Partida aberta',
      'Bloqueio',
      'Aguardando pagamento',
    ]);
    // Still only the real items.
    expect(
      within(screen.getByRole('table')).getAllByRole('button'),
    ).toHaveLength(3);
  });

  it('selects an item, shows its detail below and moves the focus there', async () => {
    const user = userEvent.setup();
    renderView();
    expect(
      screen.queryByRole('region', { name: 'Reserva selecionada' }),
    ).toBeNull();

    const button = inGrid().getByRole('button', {
      name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    expect(detail).toHaveFocus();
    expect(within(detail).getByText('Quadra 1 · 18:00–20:00')).toBeVisible();
    expect(
      within(detail).getByRole('heading', { level: 2, name: 'Ana S.' }),
    ).toBeVisible();
    expect(within(detail).getByText('Pelo app · R$ 360,00')).toBeVisible();
    expect(within(detail).getByText('Pago no Pix')).toBeVisible();
    // Messaging does not exist yet (and is only teased in the demo).
    expect(
      within(detail).queryByRole('button', { name: /Mandar mensagem/ }),
    ).toBeNull();
  });

  it('shows "Mandar mensagem" disabled in the demo', async () => {
    mocks.demo.value = true;
    const user = userEvent.setup();
    renderView();
    await user.click(
      inGrid().getByRole('button', { name: /reserva de Ana S\./ }),
    );
    const message = within(
      screen.getByRole('region', { name: 'Reserva selecionada' }),
    ).getByRole('button', { name: 'Mandar mensagem (em breve)' });
    expect(message).toBeDisabled();
    expect(message).toHaveAttribute('title', 'Em breve');
  });

  it('cancels the selected booking after confirming and refreshes', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderView();

    await user.click(
      inGrid().getByRole('button', {
        name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
      }),
    );
    const detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
    await user.click(
      within(detail).getByRole('button', { name: 'Sim, cancelar' }),
    );

    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      `/owner/bookings/${BOOKING_ID}/cancel`,
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(
      screen.queryByRole('region', { name: 'Reserva selecionada' }),
    ).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Reserva cancelada');
  });

  it('warns that a paid app booking is refunded by support, not by the owner', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(
      inGrid().getByRole('button', {
        name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
      }),
    );
    const detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    expect(
      within(detail).queryByText(/O jogador já pagou/),
    ).not.toBeInTheDocument();

    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );

    expect(
      within(detail).getByText(
        'O jogador já pagou. O reembolso será tratado pelo suporte.',
      ),
    ).toBeVisible();
  });

  it('does not talk about payment for a manual booking or a hold', async () => {
    const user = userEvent.setup();
    const hold: AgendaItem = {
      ...APP_BOOKING,
      id: '6c3f4e50-9d7b-4a9e-8d85-4e9b3f0a2c43',
      status: 'held',
      startsAt: '2026-11-02T23:00:00.000Z',
      endsAt: '2026-11-03T00:00:00.000Z',
      customerName: 'Beto P.',
    };
    renderView({
      ...agenda(),
      fields: [
        { ...agenda().fields[0], items: [hold] },
        agenda().fields[1],
      ] as OwnerAgenda['fields'],
    });

    await user.click(
      inGrid().getByRole('button', {
        name: 'Quadra 2, 21:00–22:00, reserva de Escolinha, manual, confirmada',
      }),
    );
    let detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    expect(within(detail).getByText('Pagar no local')).toBeVisible();
    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );
    expect(detail).not.toHaveTextContent('já pagou');

    await user.click(
      inGrid().getByRole('button', {
        name: /^Quadra 1, 20:00–21:00, reserva de Beto P\./,
      }),
    );
    detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    expect(within(detail).getByText('Aguardando pagamento')).toBeVisible();
    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );
    expect(detail).not.toHaveTextContent('já pagou');
  });

  it('shows the phone of a manual booking and the API refusal to cancel', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 409,
      fieldErrors: {},
      message: 'Essa reserva não pode ser cancelada',
    });
    const user = userEvent.setup();
    renderView();

    await user.click(
      inGrid().getByRole('button', {
        name: 'Quadra 2, 21:00–22:00, reserva de Escolinha, manual, confirmada',
      }),
    );
    const detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    expect(
      within(detail).getByText('Reserva manual · R$ 180,00 · (11) 98765-4321'),
    ).toBeVisible();

    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );
    await user.click(
      within(detail).getByRole('button', { name: 'Sim, cancelar' }),
    );
    expect(await within(detail).findByRole('alert')).toHaveTextContent(
      'Essa reserva não pode ser cancelada',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('removes a block after confirming', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderView();

    await user.click(
      inGrid().getByRole('button', {
        name: 'Quadra 1, 17:00–18:00, bloqueio, Manutenção',
      }),
    );
    const detail = screen.getByRole('region', { name: 'Bloqueio selecionado' });
    expect(
      within(detail).getByRole('heading', { level: 2, name: 'Bloqueio' }),
    ).toBeVisible();
    expect(within(detail).getByText('Manutenção')).toBeVisible();
    await user.click(
      within(detail).getByRole('button', { name: 'Remover bloqueio' }),
    );
    await user.click(
      within(detail).getByRole('button', { name: 'Sim, remover' }),
    );
    expect(mocks.apiSend).toHaveBeenCalledWith(
      'DELETE',
      `/owner/blocks/${BLOCK_ID}`,
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('pressing the item again or Esc closes the detail and gives the focus back', async () => {
    const user = userEvent.setup();
    renderView();
    const opener = inGrid().getByRole('button', {
      name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
    });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('region', { name: 'Reserva selecionada' }),
    ).toBeNull();
    expect(opener).toHaveFocus();
    expect(opener).toHaveAttribute('aria-pressed', 'false');

    await user.click(opener);
    await user.click(opener);
    expect(
      screen.queryByRole('region', { name: 'Reserva selecionada' }),
    ).toBeNull();
  });

  it('keeps the selection while a cancel is pending', async () => {
    mocks.apiSend.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderView();
    await user.click(
      inGrid().getByRole('button', { name: /reserva de Ana S\./ }),
    );
    const detail = screen.getByRole('region', { name: 'Reserva selecionada' });
    await user.click(
      within(detail).getByRole('button', { name: 'Cancelar reserva' }),
    );
    await user.click(
      within(detail).getByRole('button', { name: 'Sim, cancelar' }),
    );
    await user.click(
      inGrid().getByRole('button', { name: /reserva de Escolinha/ }),
    );
    await user.keyboard('{Escape}');
    expect(
      within(
        screen.getByRole('region', { name: 'Reserva selecionada' }),
      ).getByText('Ana S.'),
    ).toBeVisible();
  });

  it('creates a manual booking in the venue zone', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const dialog = screen.getByRole('dialog', { name: 'Reserva manual' });
    await user.selectOptions(
      within(dialog).getByLabelText('Quadra'),
      'Quadra 2',
    );
    await user.selectOptions(within(dialog).getByLabelText('Início'), '19:00');
    await user.selectOptions(
      within(dialog).getByLabelText('Duração'),
      '1 h 30',
    );
    await user.type(within(dialog).getByLabelText('Nome do cliente'), 'Rafa');
    await user.type(within(dialog).getByLabelText(/Telefone/), '11987654321');
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar reserva' }),
    );

    expect(mocks.apiSend).toHaveBeenCalledTimes(1);
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(method).toBe('POST');
    expect(path).toBe(`/owner/fields/${FIELD_2}/bookings`);
    expect(body).toMatchObject({
      startsAt: '2026-11-02T19:00:00-03:00',
      durationMinutes: 90,
      customerName: 'Rafa',
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Reserva manual criada',
    );
  });

  it('shows the 409 of a conflicting manual booking and keeps the form', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 409,
      fieldErrors: {},
      message: 'Esse horário já está reservado',
    });
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const dialog = screen.getByRole('dialog', { name: 'Reserva manual' });
    await user.type(within(dialog).getByLabelText('Nome do cliente'), 'Rafa');
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar reserva' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Esse horário já está reservado',
    );
    expect(within(dialog).getByLabelText('Nome do cliente')).toHaveValue(
      'Rafa',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('validates the manual form before calling the API', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const dialog = screen.getByRole('dialog', { name: 'Reserva manual' });
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar reserva' }),
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText('O nome precisa ter pelo menos 2 caracteres'),
    ).toBeVisible();
  });

  it('blocks a period of a court', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: 'Bloquear horário' }));
    const dialog = screen.getByRole('dialog', { name: 'Bloquear horário' });
    await user.selectOptions(within(dialog).getByLabelText('Início'), '20:00');
    await user.selectOptions(within(dialog).getByLabelText('Fim'), '21:00');
    await user.type(within(dialog).getByLabelText(/Motivo/), 'Chuva');
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }));

    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      `/owner/fields/${FIELD_1}/blocks`,
      {
        startsAt: '2026-11-02T20:00:00-03:00',
        endsAt: '2026-11-02T21:00:00-03:00',
        reason: 'Chuva',
      },
      expect.anything(),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Horário bloqueado');
  });

  it('shows the 409 of a block over a booking', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 409,
      fieldErrors: {},
      message: 'Já existe uma reserva nesse período',
    });
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'Bloquear horário' }));
    const dialog = screen.getByRole('dialog', { name: 'Bloquear horário' });
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe uma reserva nesse período',
    );
  });

  it('lists items that cannot sit in the grid instead of moving them', async () => {
    const user = userEvent.setup();
    const partial: AgendaItem = {
      ...APP_BOOKING,
      id: '6c3f4e50-9d7b-4a9e-8d85-4e9b3f0a2c43',
      customerName: 'Beto P.',
      // 19:00-21:00 overlaps the 18:00-20:00 booking.
      startsAt: '2026-11-02T22:00:00.000Z',
      endsAt: '2026-11-03T00:00:00.000Z',
    };
    const data = agenda();
    data.fields[0]?.items.push(partial);
    renderView(data);

    // Nothing drawn at 19:00 or 20:00 for Beto: the grid keeps the true rows.
    expect(
      within(screen.getByRole('table')).queryByRole('button', {
        name: /reserva de Beto P\./,
      }),
    ).toBeNull();
    const extra = screen.getByRole('region', {
      name: 'Outros horários nesta quadra: Quadra 1',
    });
    const button = within(extra).getByRole('button', {
      name: 'Quadra 1, 19:00–21:00, reserva de Beto P., pelo app, confirmada',
    });
    await user.click(button);
    expect(
      within(
        screen.getByRole('region', { name: 'Reserva selecionada' }),
      ).getByText('Beto P.'),
    ).toBeVisible();
  });

  it('has no overflow list when every item fits', () => {
    renderView();
    expect(screen.queryByText(/Outros horários nesta quadra/)).toBeNull();
  });

  it('does not close while a request is pending', async () => {
    mocks.apiSend.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const dialog = screen.getByRole('dialog', { name: 'Reserva manual' });
    await user.type(within(dialog).getByLabelText('Nome do cliente'), 'Rafa');
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar reserva' }),
    );
    expect(
      within(dialog).getByRole('button', { name: 'Fechar' }),
    ).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', { name: 'Reserva manual' }),
    ).toBeVisible();
  });

  it('closes with Esc when nothing is pending', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('limits the dates of the forms to 60 days ahead', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const date = within(
      screen.getByRole('dialog', { name: 'Reserva manual' }),
    ).getByLabelText('Data');
    expect(date).toHaveAttribute('min', '2026-11-02');
    expect(date).toHaveAttribute('max', '2027-01-01');
  });

  it('rejects an invalid phone before calling the API', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: '+ Reserva manual' }));
    const dialog = screen.getByRole('dialog', { name: 'Reserva manual' });
    await user.type(within(dialog).getByLabelText('Nome do cliente'), 'Rafa');
    await user.type(within(dialog).getByLabelText(/Telefone/), '123');
    await user.click(
      within(dialog).getByRole('button', { name: 'Criar reserva' }),
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(within(dialog).getByText('Telefone inválido')).toBeVisible();
  });

  it('rejects a block that ends before it starts', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'Bloquear horário' }));
    const dialog = screen.getByRole('dialog', { name: 'Bloquear horário' });
    await user.selectOptions(within(dialog).getByLabelText('Início'), '21:00');
    await user.selectOptions(within(dialog).getByLabelText('Fim'), '20:00');
    await user.click(within(dialog).getByRole('button', { name: 'Bloquear' }));
    expect(mocks.apiSend).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText('O fim precisa ser depois do início'),
    ).toBeVisible();
  });

  it('says so when the venue is closed that day and has no items', () => {
    render(
      <AgendaView
        date="2026-11-03"
        today="2026-11-02"
        timezone="America/Sao_Paulo"
        fields={[{ id: FIELD_1, name: 'Quadra 1', isActive: true, items: [] }]}
        hours={HOURS}
      />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByText('O espaço não abre neste dia e não há reservas.'),
    ).toBeVisible();
  });

  it('says so when there is no court yet', () => {
    render(
      <AgendaView
        date="2026-11-02"
        today="2026-11-02"
        timezone="America/Sao_Paulo"
        fields={[]}
        hours={HOURS}
      />,
    );
    expect(
      screen.getByText('Cadastre uma quadra para ver a agenda.'),
    ).toBeVisible();
  });
});

describe('AgendaView (phone)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demo.value = false;
  });

  it('lists the items by court instead of a grid', async () => {
    const user = userEvent.setup();
    renderView();

    const court1 = screen.getByRole('region', { name: 'Quadra 1' });
    const items = within(court1).getAllByRole('listitem');
    // Sorted by start: the block (17:00) before the booking (18:00).
    expect(items[0]).toHaveTextContent('Bloqueio');
    expect(items[1]).toHaveTextContent('Ana S.');
    const court2 = screen.getByRole('region', { name: 'Quadra 2' });
    expect(within(court2).getByText('Escolinha')).toBeVisible();

    await user.click(
      within(court1).getByRole('button', {
        name: 'Quadra 1, 18:00–20:00, reserva de Ana S., pelo app, confirmada',
      }),
    );
    expect(
      screen.getByRole('region', { name: 'Reserva selecionada' }),
    ).toBeVisible();
  });

  it('says a court is free when it has no items', () => {
    render(
      <AgendaView
        date="2026-11-02"
        today="2026-11-02"
        timezone="America/Sao_Paulo"
        fields={[{ id: FIELD_1, name: 'Quadra 1', isActive: true, items: [] }]}
        hours={HOURS}
      />,
    );
    expect(
      screen.getByText('Nenhuma reserva ou bloqueio neste dia.'),
    ).toBeVisible();
  });
});
