import type { PublicVenue } from '@arenaz/contracts';

/** Photos in the order the owner arranged them. */
export function sortedPhotos(photos: PublicVenue['photos']) {
  return [...photos].sort((a, b) => a.position - b.position);
}

/**
 * schema.org `SportsActivityLocation` of a venue. It is built field by field
 * from the PUBLIC venue, so nothing else can leak in: no street, phone or
 * exact coordinate (`geo` is the rounded one, about 1 km). The neighborhood
 * has no schema.org property of its own, so it goes into `addressLocality`.
 */
export function venueJsonLd(venue: PublicVenue, url: string) {
  const images = sortedPhotos(venue.photos).map((photo) => photo.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    url,
    ...(venue.description ? { description: venue.description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: `${venue.neighborhood}, ${venue.city}`,
      addressRegion: venue.state,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: venue.approxLocation.lat,
      longitude: venue.approxLocation.lng,
    },
  };
}

/**
 * JSON for a `<script type="application/ld+json">`. `<` is escaped so a name
 * like `</script>` cannot end the tag early (U+2028/2029 too, which older
 * parsers treat as line breaks inside strings).
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
