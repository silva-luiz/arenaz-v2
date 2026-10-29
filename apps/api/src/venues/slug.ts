export const SLUG_MAX_LENGTH = 60;
const FALLBACK_SLUG = 'espaco';

/**
 * URL-safe slug of a venue name: accents stripped, lowercase, only
 * `[a-z0-9-]`, hyphens collapsed, at most 60 characters. A name with no
 * usable characters becomes "espaco".
 */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug === '' ? FALLBACK_SLUG : slug;
}
