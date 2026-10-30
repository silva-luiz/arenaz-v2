import { Field } from '@arenaz/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from './money-input';

function Harness({
  initial = null,
  onChange,
}: {
  initial?: number | null;
  onChange: (cents: number | null) => void;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <MoneyInput
      aria-label="Preço"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('turns "R$ 1.234,50" into 123450 cents and shows it formatted on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText('Preço'), 'R$ 1.234,50');
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(123450);
    expect(screen.getByLabelText('Preço')).toHaveValue('R$ 1.234,50');
    expect(screen.queryByText('Valor inválido')).toBeNull();
  });

  it('shows "Valor inválido" and reports null for text that is not a price', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={12000} onChange={onChange} />);

    const input = screen.getByLabelText('Preço');
    await user.clear(input);
    await user.type(input, 'abc');
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Valor inválido')).toBeVisible();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Valor inválido');
    expect(input).toHaveValue('abc');
  });

  it('clears the error once a valid price is typed', async () => {
    const user = userEvent.setup();
    render(<Harness onChange={vi.fn()} />);

    const input = screen.getByLabelText('Preço');
    await user.type(input, 'abc');
    await user.tab();
    await user.clear(input);
    await user.type(input, '120,5');
    await user.tab();

    expect(screen.queryByText('Valor inválido')).toBeNull();
    expect(input).toHaveValue('R$ 120,50');
  });

  it('shows the stored value formatted and plain while editing', async () => {
    const user = userEvent.setup();
    render(<Harness initial={18000} onChange={vi.fn()} />);

    const input = screen.getByLabelText('Preço');
    expect(input).toHaveValue('R$ 180,00');

    await user.click(input);
    expect(input).toHaveValue('180,00');

    await user.tab();
    expect(input).toHaveValue('R$ 180,00');
  });

  it('is empty without a value and asks for the decimal keyboard', () => {
    render(<Harness onChange={vi.fn()} />);

    const input = screen.getByLabelText('Preço');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('keeps the parent up to date while typing, for a submit without blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByLabelText('Preço'), '90');

    expect(onChange).toHaveBeenLastCalledWith(9000);
  });

  it('takes the id, label and error that Field wires in', () => {
    render(
      <Field label="Preço base" error="O preço precisa ser maior que zero">
        <MoneyInput value={null} onChange={vi.fn()} />
      </Field>,
    );

    const input = screen.getByLabelText('Preço base');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      'O preço precisa ser maior que zero',
    );
  });
});
