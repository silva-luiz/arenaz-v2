import { createHash, timingSafeEqual } from 'node:crypto';
import { INTERNAL_TOKEN_HEADER } from '@arenaz/contracts';

export { INTERNAL_TOKEN_HEADER };

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
