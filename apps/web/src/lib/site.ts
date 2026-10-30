const FALLBACK_SITE_URL = 'http://localhost:3000';

/**
 * The origin to use for `raw`, or `null` when it is not an absolute http(s)
 * URL (a value without scheme such as "arenaz.com.br" cannot be parsed, and
 * `metadataBase`, the sitemap and robots would throw on it).
 */
function parseSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validates the configured site URL once: an unset value is the local
 * default; a malformed one falls back to it too, with a single warning.
 */
export function resolveSiteUrl(raw: string | undefined): string {
  if (!raw) return FALLBACK_SITE_URL;
  const origin = parseSiteUrl(raw);
  if (origin !== null) return origin;
  console.warn(
    `NEXT_PUBLIC_SITE_URL inválida ("${raw}"): use uma URL completa, como https://arenaz.com.br. Usando ${FALLBACK_SITE_URL}.`,
  );
  return FALLBACK_SITE_URL;
}

/**
 * Public origin of the site, for absolute URLs (OpenGraph, canonical links,
 * JSON-LD). `NEXT_PUBLIC_SITE_URL` is inlined at build time.
 */
export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** Absolute URL of a path of this site. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
