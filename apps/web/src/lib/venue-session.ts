import 'server-only';
import { INTERNAL_TOKEN_HEADER } from '@arenaz/contracts';
import { cookies } from 'next/headers';

const DEFAULT_API_URL = 'http://localhost:4000';

/** Better Auth names its cookie `<prefix>.session_token` (`__Secure-` on https). */
const SESSION_COOKIE = /session_token$/;

/**
 * Whether the visitor of a PUBLIC page has a session, only to pick between
 * "Reservar" and "sign in first". It differs from `getSession` in three ways:
 *
 * - without a session cookie it answers `false` and never calls the API (most
 *   visitors of a public page are anonymous);
 * - it sends `INTERNAL_API_TOKEN` like `publicGet`, so the call is not counted
 *   in the per-IP bucket that every server-side request shares;
 * - an outage is not fatal: the visitor is treated as signed out (a booking
 *   attempt that finds the session missing is sent to sign in by the API
 *   client), and the failure is logged on the server instead of vanishing.
 */
export async function isSignedIn(): Promise<boolean> {
  const jar = await cookies();
  if (!jar.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name))) {
    return false;
  }

  try {
    const token = process.env.INTERNAL_API_TOKEN;
    const response = await fetch(
      `${process.env.API_URL || DEFAULT_API_URL}/api/me`,
      {
        headers: {
          cookie: jar.toString(),
          ...(token ? { [INTERNAL_TOKEN_HEADER]: token } : {}),
        },
        cache: 'no-store',
      },
    );
    if (response.status === 401) return false;
    if (!response.ok) {
      throw new Error(
        `GET /api/me falhou com status ${String(response.status)}`,
      );
    }
    return true;
  } catch (error) {
    console.error(
      'Venue page: session check failed, showing signed out',
      error,
    );
    return false;
  }
}
