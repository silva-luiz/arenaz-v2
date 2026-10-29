import { z } from 'zod';

export const EMAIL_MESSAGE = 'E-mail inválido';
export const PASSWORD_MESSAGE =
  'A senha precisa ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial';
export const PHONE_MESSAGE = 'Telefone inválido';

/** Trimmed, lowercased and format-checked (normalisation runs first). */
export const emailSchema = z
  .string({ error: EMAIL_MESSAGE })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: EMAIL_MESSAGE }));

const BR_COUNTRY_CODE = '55';

/**
 * Brazilian phone number. Accepts "(11) 98765-4321", "11987654321" and
 * "+5511987654321"; outputs E.164 ("+5511987654321").
 */
export const phoneBrSchema = z
  .string({ error: PHONE_MESSAGE })
  .transform((raw, ctx) => {
    const trimmed = raw.trim();
    const digits = trimmed.replace(/\D/g, '');

    let national: string | undefined;
    if (trimmed.startsWith('+')) {
      // An explicit international prefix must be Brazil's.
      if (digits.startsWith(BR_COUNTRY_CODE)) {
        national = digits.slice(BR_COUNTRY_CODE.length);
      }
    } else if (
      (digits.length === 12 || digits.length === 13) &&
      digits.startsWith(BR_COUNTRY_CODE)
    ) {
      national = digits.slice(BR_COUNTRY_CODE.length);
    } else {
      national = digits;
    }

    // DDD (area code) + number: 10 digits (landline) or 11 (mobile, starts with 9).
    if (
      national === undefined ||
      !/^[1-9][1-9](\d{8}|9\d{8})$/.test(national)
    ) {
      ctx.issues.push({ code: 'custom', message: PHONE_MESSAGE, input: raw });
      return z.NEVER;
    }
    return `+${BR_COUNTRY_CODE}${national}`;
  });

/** Money is always integer cents. */
export const centsSchema = z.number().int().nonnegative();
