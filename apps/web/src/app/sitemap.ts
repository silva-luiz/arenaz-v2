import { publicSearchResponseSchema } from '@arenaz/contracts';
import type { MetadataRoute } from 'next';
import { publicGet } from '@/lib/public-api';
import { absoluteUrl } from '@/lib/site';

// Built when asked, never at `next build` (the API is not running then); the
// API responses are cached by the data cache for an hour.
export const dynamic = 'force-dynamic';

const REVALIDATE_SECONDS = 3600;
const MAX_PAGES = 50;

/** Slugs of every published venue, reading `GET /api/venues` page by page. */
async function publishedSlugs(): Promise<string[]> {
  const slugs = new Set<string>();
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await publicGet(
        `/venues?page=${String(page)}`,
        publicSearchResponseSchema,
        { revalidate: REVALIDATE_SECONDS },
      );
      if (!result) break;
      for (const venue of result.items) slugs.add(venue.slug);
      if (!result.hasMore) break;
    }
  } catch (error) {
    // A broken API must not break the sitemap: keep what was read so far.
    console.error('Não foi possível listar os espaços para o sitemap', error);
  }
  return [...slugs];
}

/**
 * `/`, `/buscar` and every published venue. The API exposes no modification
 * date, so `lastModified` is left out rather than made up.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await publishedSlugs();
  return [
    { url: absoluteUrl('/') },
    { url: absoluteUrl('/buscar') },
    ...slugs.map((slug) => ({
      url: absoluteUrl(`/espacos/${encodeURIComponent(slug)}`),
    })),
  ];
}
