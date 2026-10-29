import {
  buildSrcSet,
  PHOTO_VARIANT_WIDTHS,
  photoVariantKey,
} from '@arenaz/contracts';
import type { StoragePort } from './storage.port.js';

/** What every photo response carries: the original and its variants. */
export interface PhotoUrls {
  url: string;
  /** `srcset` of the resized variants; `null` while pending or when none. */
  srcSet: string | null;
}

/**
 * Public URLs of a stored photo. `variantWidths` is `venue_photo.variant_widths`
 * (NULL until the worker made the variants).
 */
export function photoUrls(
  storage: Pick<StoragePort, 'publicUrl'>,
  storageKey: string,
  variantWidths: readonly number[] | null,
): PhotoUrls {
  return {
    url: storage.publicUrl(storageKey),
    srcSet: buildSrcSet(storageKey, variantWidths, (key) =>
      storage.publicUrl(key),
    ),
  };
}

/**
 * Every object a photo may own: the original and a variant at each width.
 * All widths are named whatever `variant_widths` says (a worker run that died
 * before recording them may have written some); deleting a key that does not
 * exist is not an error.
 */
export function photoObjectKeys(storageKey: string): string[] {
  return [
    storageKey,
    ...PHOTO_VARIANT_WIDTHS.map((width) => photoVariantKey(storageKey, width)),
  ];
}
