import { z } from 'zod';
import { emailSchema, PASSWORD_MESSAGE } from './common.js';

const MIN_PASSWORD_LENGTH = 8;

export const passwordSchema = z
  .string({ error: PASSWORD_MESSAGE })
  .refine(
    (value) =>
      value.length >= MIN_PASSWORD_LENGTH &&
      /\p{Lu}/u.test(value) &&
      /\p{Ll}/u.test(value) &&
      /\p{N}/u.test(value) &&
      /[^\p{L}\p{N}\s]/u.test(value),
    { error: PASSWORD_MESSAGE },
  );

export const signUpSchema = z.object({
  name: z
    .string({ error: 'Informe seu nome' })
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres')
    .max(80, 'O nome pode ter no máximo 80 caracteres'),
  email: emailSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
