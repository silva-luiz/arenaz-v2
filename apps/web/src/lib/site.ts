/**
 * Public origin of the site, for absolute URLs (OpenGraph, canonical links,
 * JSON-LD). `NEXT_PUBLIC_SITE_URL` is inlined at build time.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** Absolute URL of a path of this site. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
