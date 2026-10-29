import 'server-only';
import { INTERNAL_TOKEN_HEADER } from '@arenaz/contracts';
import type { Parser } from './api';

// Same fallback as api.ts, session.ts and next.config.ts.
const DEFAULT_API_URL = 'http://localhost:4000';
const DEFAULT_REVALIDATE_SECONDS = 60;

export interface PublicGetOptions {
  /** Seconds the Next data cache may serve this response. Default 60. */
  revalidate?: number;
}

/**
 * Server-side GET to a PUBLIC API route.
 *
 * Unlike `apiGet` it forwards no cookie, so the response is the same for
 * everyone and Next may cache it (`next.revalidate`). The API rate-limits
 * public routes per IP and every server-side request comes from the same one,
 * so when `INTERNAL_API_TOKEN` is set it is sent as `x-internal-token` to skip
 * that limit. The token is read on the server only and never reaches a client.
 *
 * - 404 → `null` (the caller decides what a missing resource looks like).
 * - Any other non-2xx status, or a body that does not match the schema,
 *   throws.
 */
export async function publicGet<T>(
  path: string,
  schema: Parser<T>,
  { revalidate = DEFAULT_REVALIDATE_SECONDS }: PublicGetOptions = {},
): Promise<T | null> {
  const apiUrl = process.env.API_URL || DEFAULT_API_URL;
  const token = process.env.INTERNAL_API_TOKEN;
  const response = await fetch(`${apiUrl}/api${path}`, {
    headers: {
      accept: 'application/json',
      ...(token ? { [INTERNAL_TOKEN_HEADER]: token } : {}),
    },
    next: { revalidate },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `GET /api${path} falhou com status ${String(response.status)}`,
    );
  }
  return schema.parse(await response.json());
}

// Lives apart (and without `server-only`) so client components can build URLs.
export { toSearchParams } from './query-string';
