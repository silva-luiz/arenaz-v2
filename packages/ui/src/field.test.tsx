import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './input';

describe('Field', () => {
  it('links the label to the control', () => {
    render(
      <Field label="E-mail">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('E-mail');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id');
  });

  it('points aria-describedby at both the hint and the error', () => {
    render(
      <Field
        label="Nome"
        hint="Como aparece no seu perfil"
        error="Informe o nome"
      >
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Nome');
    const hint = screen.getByText('Como aparece no seu perfil');
    const error = screen.getByText('Informe o nome');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([hint.id, error.id]);
    expect(input).toHaveAccessibleDescription(
      'Como aparece no seu perfil Informe o nome',
    );
  });

  it('only describes by the hint when there is no error', () => {
    render(
      <Field label="Nome" hint="Dica">
        <Input />
      </Field>,
    );

    const input = screen.getByLabelText('Nome');
    expect(input).toHaveAccessibleDescription('Dica');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the control invalid only when there is an error', () => {
    const { rerender } = render(
      <Field label="Nome">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Nome')).not.toHaveAttribute(
      'aria-describedby',
    );

    rerender(
      <Field label="Nome" error="Informe o nome">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Nome')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('keeps the error as plain text, not a live region of its own', () => {
    render(
      <Field label="Nome" error="Informe o nome">
        <Input />
      </Field>,
    );

    expect(screen.getByText('Informe o nome')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('respects an id the control already has', () => {
    render(
      <Field label="Nome" error="Informe o nome">
        <Input id="nome" />
      </Field>,
    );

    expect(screen.getByLabelText('Nome')).toHaveAttribute('id', 'nome');
    expect(screen.getByText('Informe o nome')).toHaveAttribute(
      'id',
      'nome-error',
    );
  });
});
