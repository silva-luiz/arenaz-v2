import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './checkbox';
import { Field } from './field';
import { Input } from './input';
import { Select } from './select';
import { Textarea } from './textarea';

interface Values {
  name: string;
  sport: string;
  notes: string;
  covered: boolean;
}

function Harness({ onValid }: { onValid: (values: Values) => void }) {
  const { register, handleSubmit } = useForm<Values>({
    defaultValues: { name: 'Arena Z', sport: '', notes: '', covered: false },
  });
  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onValid)(event);
      }}
    >
      <Field label="Nome">
        <Input {...register('name')} />
      </Field>
      <Field label="Esporte">
        <Select
          options={[
            { value: 'society', label: 'Society' },
            { value: 'futsal', label: 'Futsal' },
          ]}
          placeholder="Escolha"
          {...register('sport')}
        />
      </Field>
      <Field label="Observações">
        <Textarea {...register('notes')} />
      </Field>
      <Checkbox label="Coberta" {...register('covered')} />
      <button type="submit">Enviar</button>
    </form>
  );
}

describe('react-hook-form register()', () => {
  it('reads default values and submits what the user typed', async () => {
    const onValid = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValid={onValid} />);

    expect(screen.getByLabelText('Nome')).toHaveValue('Arena Z');
    expect(screen.getByLabelText('Esporte')).toHaveValue('');

    await user.clear(screen.getByLabelText('Nome'));
    await user.type(screen.getByLabelText('Nome'), 'Arena Norte');
    await user.selectOptions(screen.getByLabelText('Esporte'), 'futsal');
    await user.type(screen.getByLabelText('Observações'), 'Piso novo');
    await user.click(screen.getByRole('checkbox', { name: 'Coberta' }));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledTimes(1);
    });
    expect(onValid.mock.calls[0]?.[0]).toEqual({
      name: 'Arena Norte',
      sport: 'futsal',
      notes: 'Piso novo',
      covered: true,
    });
  });
});

describe('ref forwarding', () => {
  it('hands the DOM node to a ref passed as a regular prop', () => {
    const input = createRef<HTMLInputElement>();
    const textarea = createRef<HTMLTextAreaElement>();
    const select = createRef<HTMLSelectElement>();
    const checkbox = createRef<HTMLInputElement>();
    render(
      <>
        <Input ref={input} aria-label="a" />
        <Textarea ref={textarea} aria-label="b" />
        <Select ref={select} aria-label="c" options={[]} />
        <Checkbox ref={checkbox} label="d" />
      </>,
    );

    expect(input.current).toBe(screen.getByLabelText('a'));
    expect(textarea.current).toBe(screen.getByLabelText('b'));
    expect(select.current).toBe(screen.getByLabelText('c'));
    expect(checkbox.current).toBe(screen.getByLabelText('d'));
  });
});
