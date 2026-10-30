import { describe, expect, it } from 'vitest';
import { passwordSchema, signInSchema, signUpSchema } from './auth.js';

describe('auth schemas', () => {
  it('normaliza e-mail', () => {
    expect(
      signUpSchema.parse({
        name: 'Joao',
        email: '  Joao@Mail.COM ',
        password: 'Senha@123',
      }).email,
    ).toBe('joao@mail.com');
  });

  it.each([
    'curta1!',
    'semmaiuscula1!',
    'SEMMINUSCULA1!',
    'SemNumero!',
    'SemEspecial1',
  ])('rejeita senha fraca %s', (password) => {
    expect(
      signUpSchema.safeParse({ name: 'Joao', email: 'j@m.com', password })
        .success,
    ).toBe(false);
  });

  it('aceita senha forte', () => {
    expect(passwordSchema.safeParse('Senha@123').success).toBe(true);
  });

  it('rejeita nome com 1 caractere após trim', () => {
    expect(
      signUpSchema.safeParse({
        name: ' J ',
        email: 'j@m.com',
        password: 'Senha@123',
      }).success,
    ).toBe(false);
  });

  it('usa mensagens em pt-BR', () => {
    const email = signUpSchema.safeParse({
      name: 'Joao',
      email: 'invalido',
      password: 'Senha@123',
    });
    expect(email.error?.issues[0]?.message).toBe('E-mail inválido');

    const password = passwordSchema.safeParse('fraca');
    expect(password.error?.issues[0]?.message).toBe(
      'A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial',
    );
  });

  it('normaliza e-mail no login', () => {
    expect(
      signInSchema.parse({ email: ' Joao@Mail.com ', password: 'x' }).email,
    ).toBe('joao@mail.com');
  });
});
