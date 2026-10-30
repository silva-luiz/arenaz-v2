import type { PriceRule } from '@arenaz/contracts';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

import { PriceRulesEditor } from './price-rules-editor';

const FIELD_ID = '8a1d6c34-2f0b-4b52-8d65-5c7f2f6f9a21';

const WEEKNIGHTS: PriceRule = {
  id: '11111111-1111-4111-8111-111111111111',
  weekdays: [1, 2, 3, 4, 5],
  startMinute: 18 * 60,
  endMinute: 22 * 60,
  priceCentsPerHour: 24000,
  label: 'Noite',
};

const WEEKEND: PriceRule = {
  id: '22222222-2222-4222-8222-222222222222',
  weekdays: [0, 6],
  startMinute: 8 * 60,
  endMinute: 22 * 60,
  priceCentsPerHour: 20000,
  label: null,
};

function row(n: number) {
  return screen.getByRole('group', { name: `Faixa ${String(n)}` });
}

describe('PriceRulesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains what no rules means', () => {
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[]} />);

    expect(screen.getByText(/Nenhuma faixa de preço/)).toBeVisible();
    expect(screen.getByRole('button', { name: '+ Faixa' })).toBeVisible();
  });

  it('shows each rule with days, times, price and label', () => {
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[WEEKNIGHTS, WEEKEND]}
      />,
    );

    const first = within(row(1));
    expect(first.getByRole('button', { name: 'Segunda' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(first.getByRole('button', { name: 'Sábado' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(first.getByLabelText('Início')).toHaveValue('1080');
    expect(first.getByLabelText('Início')).toHaveDisplayValue('18:00');
    expect(first.getByLabelText('Fim')).toHaveDisplayValue('22:00');
    expect(first.getByLabelText('Preço por hora')).toHaveValue('R$ 240,00');
    expect(first.getByLabelText('Rótulo')).toHaveValue('Noite');
    expect(
      within(row(2)).getByRole('button', { name: 'Domingo' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers every 30 minutes from 00:00 to 24:00', () => {
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    const options = within(row(1))
      .getByLabelText('Fim')
      .querySelectorAll('option');
    expect(options).toHaveLength(49);
    expect(options[0]).toHaveTextContent('00:00');
    expect(options[48]).toHaveTextContent('24:00');
  });

  it('adds and removes rows', async () => {
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.click(screen.getByRole('button', { name: '+ Faixa' }));
    expect(row(2)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }));
    expect(screen.queryByRole('group', { name: 'Faixa 2' })).toBeNull();
    expect(within(row(1)).getByLabelText('Preço por hora')).toHaveValue('');
  });

  it('moves the focus to the neighbouring row after removing one', async () => {
    const user = userEvent.setup();
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[WEEKNIGHTS, WEEKEND]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }));

    // The former second row is now the first.
    expect(
      screen.getByRole('button', { name: 'Remover faixa 1' }),
    ).toHaveFocus();
  });

  it('falls back to the previous row when the last one is removed', async () => {
    const user = userEvent.setup();
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[WEEKNIGHTS, WEEKEND]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remover faixa 2' }));

    expect(
      screen.getByRole('button', { name: 'Remover faixa 1' }),
    ).toHaveFocus();
  });

  it('focuses "+ Faixa" when the only row is removed', async () => {
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }));

    expect(screen.getByRole('button', { name: '+ Faixa' })).toHaveFocus();
  });

  it('disables the rows while saving', async () => {
    let answer: (value: unknown) => void = () => undefined;
    mocks.apiSend.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    await waitFor(() => {
      expect(within(row(1)).getByLabelText('Preço por hora')).toBeDisabled();
    });
    expect(
      within(row(1)).getByRole('button', { name: 'Sexta' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remover faixa 1' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Faixa' })).toBeDisabled();

    await act(async () => {
      answer({ ok: true, data: [WEEKEND] });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(within(row(1)).getByLabelText('Preço por hora')).toBeEnabled();
    });
  });

  it('toggles a weekday', async () => {
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    const friday = within(row(1)).getByRole('button', { name: 'Sexta' });
    await user.click(friday);
    expect(friday).toHaveAttribute('aria-pressed', 'true');

    await user.click(friday);
    expect(friday).toHaveAttribute('aria-pressed', 'false');
  });

  it('saves the full list with PUT and refreshes', async () => {
    const saved = [WEEKNIGHTS, WEEKEND];
    mocks.apiSend.mockResolvedValue({ ok: true, data: saved });
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={saved} />);

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Faixas salvas');
    });
    const [method, path, body] = mocks.apiSend.mock.calls[0] as [
      string,
      string,
      unknown,
    ];
    expect(method).toBe('PUT');
    expect(path).toBe(`/owner/fields/${FIELD_ID}/price-rules`);
    expect(body).toEqual([
      {
        weekdays: [1, 2, 3, 4, 5],
        startMinute: 1080,
        endMinute: 1320,
        priceCentsPerHour: 24000,
        label: 'Noite',
      },
      {
        weekdays: [0, 6],
        startMinute: 480,
        endMinute: 1320,
        priceCentsPerHour: 20000,
      },
    ]);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('can save an empty list to drop every rule', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: [] });
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.click(screen.getByRole('button', { name: 'Remover faixa 1' }));
    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    await waitFor(() => {
      expect(mocks.apiSend).toHaveBeenCalled();
    });
    expect(mocks.apiSend.mock.calls[0]?.[2]).toEqual([]);
  });

  it('flags the later row of an overlap without calling the API', async () => {
    const user = userEvent.setup();
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[
          WEEKNIGHTS,
          { ...WEEKNIGHTS, id: WEEKEND.id, label: null, startMinute: 20 * 60 },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(
      within(row(2)).getByText('Faixas de preço se sobrepõem'),
    ).toBeVisible();
    expect(
      within(row(1)).queryByText('Faixas de preço se sobrepõem'),
    ).toBeNull();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('asks for the days and the price of a new row', async () => {
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[]} />);

    await user.click(screen.getByRole('button', { name: '+ Faixa' }));
    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(within(row(1)).getByText('Informe o preço por hora')).toBeVisible();
    expect(
      within(row(1)).getByText('Selecione pelo menos um dia'),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija as faixas destacadas.',
    );
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('flags an end that is not after the start', async () => {
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.selectOptions(within(row(1)).getByLabelText('Fim'), '08:00');
    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(
      within(row(1)).getByText('O fim precisa ser depois do início'),
    ).toBeVisible();
    expect(mocks.apiSend).not.toHaveBeenCalled();
  });

  it('shows the server overlap message on the matching row (errors "1" is row 2)', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: { '1': ['Faixas de preço se sobrepõem'] },
      message: 'Corrija os campos destacados.',
    });
    const user = userEvent.setup();
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[WEEKNIGHTS, WEEKEND]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(
      await within(row(2)).findByText('Faixas de preço se sobrepõem'),
    ).toBeVisible();
    expect(
      within(row(1)).queryByText('Faixas de preço se sobrepõem'),
    ).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Corrija os campos destacados.',
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('accepts nested server keys such as "1.endMinute"', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 422,
      fieldErrors: { '1.endMinute': ['O fim precisa ser depois do início'] },
      message: 'Corrija os campos destacados.',
    });
    const user = userEvent.setup();
    render(
      <PriceRulesEditor
        fieldId={FIELD_ID}
        initialRules={[WEEKNIGHTS, WEEKEND]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(
      await within(row(2)).findByText('O fim precisa ser depois do início'),
    ).toBeVisible();
  });

  it('shows the server message when it names no row', async () => {
    mocks.apiSend.mockResolvedValue({
      ok: false,
      status: 500,
      fieldErrors: {},
      message: 'Não foi possível concluir. Tente novamente.',
    });
    const user = userEvent.setup();
    render(<PriceRulesEditor fieldId={FIELD_ID} initialRules={[WEEKEND]} />);

    await user.click(screen.getByRole('button', { name: 'Salvar faixas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Tente novamente.',
    );
  });
});
