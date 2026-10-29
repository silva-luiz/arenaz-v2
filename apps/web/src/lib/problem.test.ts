import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR, problemToFormError } from './problem';

describe('problemToFormError', () => {
  it('prefers the Problem detail', () => {
    expect(
      problemToFormError({ title: 'Dados inválidos', detail: 'Ops' }, 422),
    ).toEqual({ message: 'Ops', fieldErrors: {} });
  });

  it('falls back to message, then to a generic text', () => {
    expect(problemToFormError({ message: 'Algo' }, 400).message).toBe('Algo');
    expect(problemToFormError({}, 500).message).toBe(GENERIC_ERROR);
  });

  it('maps Problem.errors and ignores malformed entries', () => {
    const result = problemToFormError(
      { errors: { cep: ['CEP inválido'], bad: [1], worse: 'x' } },
      422,
    );
    expect(result.fieldErrors).toEqual({ cep: ['CEP inválido'] });
    expect(result.message).toBe('Corrija os campos destacados.');
  });

  it('tolerates bodies that are not objects', () => {
    for (const body of [null, undefined, 'texto', 42, ['x']]) {
      expect(problemToFormError(body, 500)).toEqual({
        message: GENERIC_ERROR,
        fieldErrors: {},
      });
    }
  });

  it('explains rate limiting when the body says nothing', () => {
    expect(problemToFormError({}, 429).message).toMatch(/Muitas tentativas/);
    expect(problemToFormError({ detail: 'Calma' }, 429).message).toBe('Calma');
  });
});
