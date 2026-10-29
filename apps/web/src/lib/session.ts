import 'server-only';
import { meResponseSchema, type MeResponse } from '@arenaz/contracts';
import { cookies } from 'next/headers';

const DEFAULT_API_URL = 'http://localhost:4000';

/**
 * Resolves the signed-in user by forwarding the request cookies to the API.
 * `null` means "not signed in" (no, expired or forged session); any other
 * failure throws so an outage is never mistaken for a logout.
 */
export async function getSession(): Promise<MeResponse | null> {
  const apiUrl = process.env.API_URL || DEFAULT_API_URL;
  const response = await fetch(`${apiUrl}/api/me`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`GET /api/me falhou com status ${String(response.status)}`);
  }
  return meResponseSchema.parse(await response.json());
}
