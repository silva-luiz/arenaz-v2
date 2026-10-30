import { describe, expect, it } from 'vitest';
import { makeVenue } from '@/test/venue-fixture';
import { serializeJsonLd, venueJsonLd } from './venue-jsonld';

const PAGE_URL = 'https://arenaz.test/espacos/arena-vila-madalena';

describe('venueJsonLd', () => {
  it('describes the venue as a SportsActivityLocation', () => {
    const data = venueJsonLd(makeVenue(), PAGE_URL);

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SportsActivityLocation',
      name: 'Arena Vila Madalena',
      url: PAGE_URL,
      image: ['http://storage.test/a.jpg', 'http://storage.test/b.jpg'],
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -23.55,
        longitude: -46.69,
      },
    });
  });

  it('keeps the address to neighborhood, city and state', () => {
    const { address } = venueJsonLd(makeVenue(), PAGE_URL);

    expect(address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Vila Madalena, São Paulo',
      addressRegion: 'SP',
    });
  });

  it('never carries a street, phone or anything outside the public venue', () => {
    const leaky = {
      ...makeVenue(),
      phone: '+5511987654321',
      street: 'Rua Harmonia',
      number: '123',
      cep: '05435000',
      location: { lat: -23.5512345, lng: -46.6912345 },
    };
    const json = serializeJsonLd(venueJsonLd(leaky, PAGE_URL));

    expect(json).not.toMatch(/streetAddress|telephone|postalCode/);
    expect(json).not.toContain('5511987654321');
    expect(json).not.toContain('Rua Harmonia');
    expect(json).not.toContain('05435000');
    expect(json).not.toContain('-23.5512345');
  });

  it('leaves out the image and the description when there are none', () => {
    const data = venueJsonLd(
      makeVenue({ photos: [], description: null }),
      PAGE_URL,
    );

    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('description');
  });

  it('lists the photos in position order', () => {
    const [first, second] = makeVenue().photos;
    if (!first || !second) throw new Error('fixture');
    const data = venueJsonLd(makeVenue({ photos: [second, first] }), PAGE_URL);

    expect(data.image).toEqual([first.url, second.url]);
  });
});

describe('serializeJsonLd', () => {
  it('escapes "<" so the text cannot close the script tag', () => {
    const json = serializeJsonLd({
      name: '</script><script>alert(1)</script>',
    });

    expect(json).not.toContain('<');
    expect(json).toContain('\\u003c/script>');
    expect(JSON.parse(json)).toEqual({
      name: '</script><script>alert(1)</script>',
    });
  });

  it('escapes the line and paragraph separators too', () => {
    const ls = String.fromCharCode(0x2028);
    const ps = String.fromCharCode(0x2029);
    const json = serializeJsonLd({ name: `a${ls}b${ps}c` });

    expect(json).not.toContain(ls);
    expect(json).not.toContain(ps);
    expect(json).toContain('a\\u2028b\\u2029c');
    expect(JSON.parse(json)).toEqual({ name: `a${ls}b${ps}c` });
  });
});
