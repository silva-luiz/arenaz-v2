import { createAuthClient } from 'better-auth/react';

/** Same-origin client: requests go to `/api/auth/*`, proxied to the API. */
export const authClient = createAuthClient();

export const GENERIC_ERROR = 'Não foi possível concluir. Tente novamente.';
const FIELD_ERRORS_MESSAGE = 'Corrija os campos destacados.';

export interface AuthErrorInfo {
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
 * Maps the `error` of a Better Auth client call to what the forms show.
 *
 * The API answers `application/problem+json` (`{ type, title, status, detail?,
 * errors?, code? }`). Better Auth's fetch layer spreads the parsed body into
 * `error` and adds `status` / `statusText`, so `detail` and `errors` are on
 * `error` itself (the TS type only declares `message`/`status`/`statusText`,
 * hence the `unknown` input).
 */
export function parseAuthError(error: unknown): AuthErrorInfo {
  const source = isRecord(error) ? error : {};

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
    (hasFieldErrors ? FIELD_ERRORS_MESSAGE : GENERIC_ERROR);

  return { message, fieldErrors };
}
