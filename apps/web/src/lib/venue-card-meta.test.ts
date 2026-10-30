import { describe, expect, it } from 'vitest';
import { venueCardMeta } from './venue-card-meta';

describe('venueCardMeta', () => {
  it('joins neighborhood and sports', () => {
    expect(
      venueCardMeta({
        neighborhood: 'Vila Madalena',
        sports: ['futebol_society', 'futsal'],
        distanceKm: null,
      }),
    ).toBe('Vila Madalena · Society · Futsal');
  });

  it('appends the distance in pt-BR, zero included', () => {
    const venue = {
      neighborhood: 'Pinheiros',
      sports: ['padel'],
      distanceKm: 1.2,
    } as const;
    expect(venueCardMeta({ ...venue, sports: [...venue.sports] })).toBe(
      'Pinheiros · Padel · 1,2 km',
    );
    expect(
      venueCardMeta({ neighborhood: 'Lapa', sports: [], distanceKm: 0 }),
    ).toBe('Lapa · 0,0 km');
  });
});
