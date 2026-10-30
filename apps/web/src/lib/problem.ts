export const GENERIC_ERROR = 'Não foi possível concluir. Tente novamente.';
const FIELD_ERRORS_MESSAGE = 'Corrija os campos destacados.';
const RATE_LIMIT_MESSAGE =
  'Muitas tentativas. Aguarde um instante e tente de novo.';

export interface FormErrorInfo {
  /** Text for the form-level alert. */
  message: string;
  /** Messages per field name, from `Problem.errors`. */
  fieldErrors: Record<string, string[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Maps an `application/problem+json` body (`{ type, title, status, detail?,
 * errors? }`) to what the forms show: a message for the alert and messages
 * per field. `message` is accepted after `detail` because Better Auth's fetch
 * layer puts its own text there. Anything malformed falls back to a generic
 * text, so callers never have to guard the body.
 */
export function problemToFormError(
  body: unknown,
  status: number,
): FormErrorInfo {
  const source = isRecord(body) ? body : {};

  const fieldErrors: Record<string, string[]> = {};
  if (isRecord(source.errors)) {
    for (const [field, messages] of Object.entries(source.errors)) {
      if (!Array.isArray(messages)) continue;
      const texts = messages.filter(
        (item): item is string => typeof item === 'string',
      );
      if (texts.length > 0) fieldErrors[field] = texts;
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const message =
    nonEmptyString(source.detail) ??
    nonEmptyString(source.message) ??
    (hasFieldErrors ? FIELD_ERRORS_MESSAGE : undefined) ??
    (status === 429 ? RATE_LIMIT_MESSAGE : GENERIC_ERROR);

  return { message, fieldErrors };
}
