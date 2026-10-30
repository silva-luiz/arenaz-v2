/** Postgres SQLSTATE of an exclusion constraint violation. */
export const EXCLUSION_VIOLATION = '23P01';

/**
 * True when `error` is a Postgres error with that SQLSTATE. Drizzle wraps the
 * driver error and keeps it in `cause`, so the chain is followed (a few levels).
 */
export function hasPgCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    const { code: found, cause } = current as {
      code?: unknown;
      cause?: unknown;
    };
    if (found === code) return true;
    current = cause;
  }
  return false;
}
