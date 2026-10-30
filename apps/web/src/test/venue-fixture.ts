import type { PublicField, PublicVenue } from '@arenaz/contracts';

/** A published venue as the public API returns it, for tests. */
export function makeField(overrides: Partial<PublicField> = {}): PublicField {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Quadra 1',
    sports: ['futebol_society'],
    surface: 'grama_sintetica',
    format: '7x7',
    lengthM: 40,
    widthM: 20,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 18000,
    priceRules: [],
    ...overrides,
  };
}

export function makeVenue(overrides: Partial<PublicVenue> = {}): PublicVenue {
  return {
    slug: 'arena-vila-madalena',
    name: 'Arena Vila Madalena',
    description: 'Society coberto com vestiário.\nEstacionamento no local.',
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    approxLocation: { lat: -23.55, lng: -46.69 },
    amenities: ['vestiario', 'estacionamento'],
    cancellationPolicy: 'moderada',
    timezone: 'America/Sao_Paulo',
    hours: [
      { weekday: 1, openMinute: 480, closeMinute: 1320 },
      { weekday: 2, openMinute: 480, closeMinute: 1320 },
      { weekday: 6, openMinute: 540, closeMinute: 1440 },
    ],
    photos: [
      {
        id: '22222222-2222-4222-8222-222222222221',
        url: 'http://storage.test/a.jpg',
        srcSet:
          'http://storage.test/a.w400.webp 400w, http://storage.test/a.w800.webp 800w',
        position: 0,
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        url: 'http://storage.test/b.jpg',
        srcSet: null,
        position: 1,
      },
    ],
    host: { firstName: 'Marcos' },
    fields: [makeField()],
    ...overrides,
  };
}
