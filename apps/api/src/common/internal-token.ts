import { createHash, timingSafeEqual } from 'node:crypto';

/** Header the web's server sends on its own (server-side) API calls. */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const digest = (value: string): Buffer =>
  createHash('sha256').update(value).digest();

/**
 * True when `received` (a header value) equals the configured token. The
 * comparison is constant-time (both sides are hashed to the same length
 * first). With no configured token the feature is off: always false.
 */
export function isInternalRequest(
  received: string | string[] | undefined,
  expected: string | undefined,
): boolean {
  if (expected === undefined || typeof received !== 'string') return false;
  return timingSafeEqual(digest(received), digest(expected));
}
