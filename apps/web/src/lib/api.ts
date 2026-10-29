import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

// Same fallback as session.ts and next.config.ts.
const DEFAULT_API_URL = 'http://localhost:4000';

/** What a zod schema offers; keeps this module free of a direct zod import. */
export interface Parser<T> {
  parse(input: unknown): T;
}

/**
 * Server-side GET to the API, forwarding the request cookies (never cached).
 *
 * - 401 → redirects to the sign-in page, which brings the user back to
 *   `currentPath`. Server components cannot read their own path, so each page
 *   passes it in.
 * - 404 → the not-found page (the API also answers 404 for another owner's
 *   resource, so existence is not revealed).
 * - Anything else throws, as does a body that does not match the schema.
 */
export async function apiGet<T>(
  path: string,
  schema: Parser<T>,
  currentPath: string,
): Promise<T> {
  const apiUrl = process.env.API_URL || DEFAULT_API_URL;
  const response = await fetch(`${apiUrl}/api${path}`, {
    headers: { cookie: (await cookies()).toString() },
    cache: 'no-store',
  });

  if (response.status === 401) {
    redirect(
      `/entrar?next=${encodeURIComponent(currentPath).replaceAll('%2F', '/')}`,
    );
  }
  if (response.status === 404) notFound();
  if (!response.ok) {
    throw new Error(
      `GET /api${path} falhou com status ${String(response.status)}`,
    );
  }
  return schema.parse(await response.json());
}
