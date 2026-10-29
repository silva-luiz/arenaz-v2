import type { Block } from '@arenaz/contracts';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiSend: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({ apiSend: mocks.apiSend }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: mocks.refresh }),
}));

import { BlocksEditor } from './blocks-editor';

const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

const MAINTENANCE: Block = {
  id: '33333333-3333-4333-8333-333333333333',
  startsAt: '2026-10-31T21:00:00.000Z',
  endsAt: '2026-11-01T01:00:00.000Z',
  reason: 'Manutenção',
};

const NO_REASON: Block = {
  id: '44444444-4444-4444-8444-444444444444',
  startsAt: '2026-11-07T12:00:00.000Z',
  endsAt: '2026-11-07T14:00:00.000Z',
  reason: null,
};

function fill(date: string, start: string, end: string, reason?: string) {
  fireEvent.change(screen.getByLabelText('Data'), { target: { value: date } });
  return (async () => {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Início'), start);
    await user.selectOptions(screen.getByLabelText('Fim'), end);
    if (reason !== undefined) {
      await user.type(screen.getByLabelText('Motivo'), reason);
    }
    await user.click(screen.getByRole('button', { name: 'Bloquear período' }));
  })();
}

describe('BlocksEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists the blocks in São Paulo time with the reason', () => {
    render(
      <BlocksEditor
        fieldId={FIELD_ID}
        initialBlocks={[MAINTENANCE, NO_REASON]}
      />,
    );

    expect(
      screen.getByText('Sáb, 31/10 das 18:00 às 22:00 — Manutenção'),
    ).toBeVisible();
    expect(screen.getByText('Sáb, 07/11 das 09:00 às 11:00')).toBeVisible();
  });

  it('says there are no blocks', () => {
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    expect(screen.getByText('Nenhum bloqueio futuro.')).toBeVisible();
  });

  it('creates a block with the São Paulo offset of that date', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: true,
      data: { ...MAINTENANCE, reason: 'Torneio' },
    });
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    await fill('2026-10-31', '18:00', '22:00', '  Torneio ');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bloqueio adicionado',
      );
    });
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      unknown,
    ];
    expect(method).toBe('POST');
    expect(path).toBe(`/owner/fields/${FIELD_ID}/blocks`);
    expect(body).toEqual({
      startsAt: '2026-10-31T18:00:00-03:00',
      endsAt: '2026-10-31T22:00:00-03:00',
      reason: 'Torneio',
    });
    expect(
      screen.getByText('Sáb, 31/10 das 18:00 às 22:00 — Torneio'),
    ).toBeVisible();
    expect(screen.queryByText('Nenhum bloqueio futuro.')).toBeNull();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByLabelText('Motivo')).toHaveValue('');
  });

  it('sends an end of 24:00 as midnight of the next day and no empty reason', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: MAINTENANCE });
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    await fill('2026-10-31', '22:00', '24:00');

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[2]).toEqual({
      startsAt: '2026-10-31T22:00:00-03:00',
      endsAt: '2026-11-01T00:00:00-03:00',
    });
  });

  it('asks for the date', async () => {
    const user = userEvent.setup();
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    await user.click(screen.getByRole('button', { name: 'Bloquear período' }));

    expect(screen.getByText('Informe a data')).toBeVisible();
    expect(screen.getByLabelText('Data')).toBeInvalid();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('does not call the API when the end is not after the start', async () => {
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    await fill('2026-10-31', '22:00', '18:00');

    expect(
      await screen.findByText('O fim precisa ser depois do início'),
    ).toBeVisible();
    expect(screen.getByLabelText('Fim')).toBeInvalid();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('shows the 409 detail when the period is already blocked', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 409,
      fieldErrors: {},
      message: 'Já existe um bloqueio nesse período',
    });
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    await fill('2026-10-31', '18:00', '22:00');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um bloqueio nesse período',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('asks before deleting and then removes the block', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(
      <BlocksEditor
        fieldId={FIELD_ID}
        initialBlocks={[MAINTENANCE, NO_REASON]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText('Sáb, 31/10 das 18:00 às 22:00 — Manutenção'),
      ).toBeNull();
    });
    const call = mocks.apiSend.mock.calls[0] as unknown[];
    expect(call[0]).toBe('DELETE');
    expect(call[1]).toBe(`/owner/blocks/${MAINTENANCE.id}`);
    expect(call[2]).toBeUndefined();
    expect(screen.getByText('Sáb, 07/11 das 09:00 às 11:00')).toBeVisible();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('cancels the deletion without calling the API', async () => {
    const user = userEvent.setup();
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[MAINTENANCE]} />);

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Confirmar exclusão' }),
    ).toBeNull();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('returns the focus to the trigger after cancelling', async () => {
    const user = userEvent.setup();
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[MAINTENANCE]} />);

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    ).toHaveFocus();
  });

  it('moves the focus to the next block after a deletion', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(
      <BlocksEditor
        fieldId={FIELD_ID}
        initialBlocks={[MAINTENANCE, NO_REASON]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    // The former second block is now the first.
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
      ).toHaveFocus();
    });
  });

  it('falls back to the previous block, then to the date field', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: undefined });
    const user = userEvent.setup();
    render(
      <BlocksEditor
        fieldId={FIELD_ID}
        initialBlocks={[MAINTENANCE, NO_REASON]}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 2' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
      ).toHaveFocus();
    });

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText('Data')).toHaveFocus();
    });
  });

  it('disables the form while a block is being saved', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mocks.apiSend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

    const pending = fill('2026-10-31', '18:00', '22:00', 'Torneio');
    await waitFor(() => {
      expect(screen.getByLabelText('Motivo')).toBeDisabled();
    });
    expect(screen.getByLabelText('Data')).toBeDisabled();
    expect(screen.getByLabelText('Início')).toBeDisabled();

    await act(async () => {
      answer({ ok: true, data: MAINTENANCE });
      await Promise.resolve();
    });
    await pending;
    await waitFor(() => {
      expect(screen.getByLabelText('Motivo')).toBeEnabled();
    });
  });

  it('does not offer days before today in São Paulo', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 01:00 UTC is still the evening of the 29th in São Paulo.
    vi.setSystemTime(new Date('2026-10-30T01:00:00.000Z'));
    try {
      render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[]} />);

      expect(screen.getByLabelText('Data')).toHaveAttribute(
        'min',
        '2026-10-29',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the block and says why when the deletion fails', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 500,
      fieldErrors: {},
      message: 'Não foi possível concluir. Tente novamente.',
    });
    const user = userEvent.setup();
    render(<BlocksEditor fieldId={FIELD_ID} initialBlocks={[MAINTENANCE]} />);

    await user.click(
      screen.getByRole('button', { name: 'Excluir bloqueio 1' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    );

    const item = screen.getByText(/Manutenção/).closest('li');
    expect(item).not.toBeNull();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Tente novamente.',
    );
    expect(within(item as HTMLElement).getByText(/Manutenção/)).toBeVisible();
  });
});
