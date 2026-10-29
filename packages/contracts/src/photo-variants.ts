// Zod-free on purpose: the worker and the web import these helpers without
// pulling the schemas in.

/**
 * Widths (px) of the resized WebP copies the worker makes of every photo. Only
 * the widths smaller than the original are produced.
 */
export const PHOTO_VARIANT_WIDTHS = [400, 800, 1600] as const;

/**
 * Storage key of a photo's `width` px variant: the original key with its
 * extension replaced by `.w{width}.webp` (`venues/a/b.jpg` →
 * `venues/a/b.w400.webp`).
 */
export function photoVariantKey(storageKey: string, width: number): string {
  const slash = storageKey.lastIndexOf('/');
  const dot = storageKey.lastIndexOf('.');
  const base = dot > slash ? storageKey.slice(0, dot) : storageKey;
  return `${base}.w${String(width)}.webp`;
}

/**
 * `srcset` value for a photo (`"<url> 400w, <url> 800w"`) from the widths the
 * worker produced, or `null` while they are pending or when there are none
 * (the original alone is then served).
 */
export function buildSrcSet(
  storageKey: string,
  widths: readonly number[] | null,
  publicUrl: (key: string) => string,
): string | null {
  if (!widths || widths.length === 0) return null;
  return [...widths]
    .sort((a, b) => a - b)
    .map(
      (width) =>
        `${publicUrl(photoVariantKey(storageKey, width))} ${String(width)}w`,
    )
    .join(', ');
}
