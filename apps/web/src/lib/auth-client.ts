import { createAuthClient } from 'better-auth/react';
import {
  GENERIC_ERROR,
  problemToFormError,
  type FormErrorInfo,
} from './problem';

/** Same-origin client: requests go to `/api/auth/*`, proxied to the API. */
export const authClient = createAuthClient();

export { GENERIC_ERROR };
export type AuthErrorInfo = FormErrorInfo;

/**
 * Maps the `error` of a Better Auth client call to what the forms show.
 *
 * The API answers `application/problem+json`. Better Auth's fetch layer
 * spreads the parsed body into `error` and adds `status` / `statusText`, so
 * `detail` and `errors` are on `error` itself (the TS type only declares
 * `message`/`status`/`statusText`, hence the `unknown` input).
 */
export function parseAuthError(error: unknown): AuthErrorInfo {
  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
      ? error.status
      : 0;
  return problemToFormError(error, status);
}
