import 'server-only';
import {
  PUBLIC_SLUG_PATTERN,
  publicVenueSchema,
  type PublicVenue,
} from '@arenaz/contracts';
import { publicGet } from './public-api';

// How long the Next data cache may serve the public venue (see `publicGet`).
const REVALIDATE_SECONDS = 60;

/**
 * A published venue by slug, or `null` when it does not exist (or is not
 * published: the API answers 404 for both). A slug that can never exist skips
 * the request. The venue page, its metadata and its header search all ask;
 * Next shares the identical `fetch` between them.
 */
export async function loadPublicVenue(
  slug: string,
): Promise<PublicVenue | null> {
  if (!PUBLIC_SLUG_PATTERN.test(slug)) return null;
  return publicGet(`/venues/${encodeURIComponent(slug)}`, publicVenueSchema, {
    revalidate: REVALIDATE_SECONDS,
  });
}
