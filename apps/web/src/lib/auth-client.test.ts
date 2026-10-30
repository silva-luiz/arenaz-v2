import { describe, expect, it } from 'vitest';
import { parseAuthError } from './auth-client';

const GENERIC = 'Não foi possível concluir. Tente novamente.';

describe('parseAuthError', () => {
  it('prefers the Problem detail', () => {
    expect(
      parseAuthError({
        status: 401,
        title: 'Não autenticado',
        detail: 'E-mail ou senha inválidos',
      }),
    ).toEqual({ message: 'E-mail ou senha inválidos', fieldErrors: {} });
  });

  it('falls back to message', () => {
    expect(parseAuthError({ status: 422, message: 'Algo' }).message).toBe(
      'Algo',
    );
  });

  it('maps Problem.errors to field errors', () => {
    const result = parseAuthError({
      status: 422,
      errors: { email: ['E-mail inválido'], password: ['a', 'b'] },
    });
    expect(result.fieldErrors).toEqual({
      email: ['E-mail inválido'],
      password: ['a', 'b'],
    });
    expect(result.message).toBe('Corrija os campos destacados.');
  });

  it('ignores malformed errors and falls back to a generic message', () => {
    expect(parseAuthError({ status: 500, errors: 'x' })).toEqual({
      message: GENERIC,
      fieldErrors: {},
    });
    expect(parseAuthError({ errors: { email: [1] } }).fieldErrors).toEqual({});
    expect(parseAuthError(null).message).toBe(GENERIC);
    expect(parseAuthError(undefined).message).toBe(GENERIC);
  });
});
