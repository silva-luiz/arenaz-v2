import type { Availability, PublicVenueCard } from '@arenaz/contracts';
import { describe, expect, it } from 'vitest';
import {
  RAIL_LIMIT,
  freeStartHref,
  nextFreeStarts,
  pickTonight,
} from './tonight';

function card(slug: string, nextFreeTime: string | null): PublicVenueCard {
  return {
    slug,
    name: slug,
    neighborhood: 'Lapa',
    city: 'São Paulo',
    state: 'SP',
    coverUrl: null,
    coverSrcSet: null,
    sports: ['futsal'],
    minPriceCentsPerHour: 10000,
    approxLocation: { lat: -23.5, lng: -46.7 },
    distanceKm: null,
    nextFreeTime,
  };
}

describe('pickTonight', () => {
  it('keeps the venues free today, earliest first', () => {
    const result = pickTonight([
      card('a', '21:00'),
      card('b', null),
      card('c', '19:30'),
    ]);
    expect(result.free).toBe(true);
    expect(result.items.map((venue) => venue.slug)).toEqual(['c', 'a']);
  });

  it('falls back to every venue when none is free', () => {
    const result = pickTonight([card('a', null), card('b', null)]);
    expect(result).toEqual({
      free: false,
      items: [card('a', null), card('b', null)],
    });
  });

  it('shows at most RAIL_LIMIT venues', () => {
    const many = Array.from({ length: RAIL_LIMIT + 3 }, (_, index) =>
      card(String(index), '20:00'),
    );
    expect(pickTonight(many).items).toHaveLength(RAIL_LIMIT);
  });

  it('is empty for an empty list', () => {
    expect(pickTonight([])).toEqual({ free: false, items: [] });
  });
});

const NOW = Date.parse('2026-10-29T18:00:00Z'); // 15:00 in São Paulo

function slot(startsAt: string, available: boolean) {
  return { startsAt, endsAt: startsAt, available, priceCents: 1 };
}

const AVAILABILITY: Availability = {
  date: '2026-10-29',
  timezone: 'America/Sao_Paulo',
  fields: [
    {
      id: 'a',
      name: 'A',
      minSlotMinutes: 60,
      slots: [
        slot('2026-10-29T18:00:00Z', true), // now: not after it
        slot('2026-10-29T22:30:00Z', true),
        slot('2026-10-29T21:00:00Z', false),
      ],
    },
    {
      id: 'b',
      name: 'B',
      minSlotMinutes: 30,
      slots: [
        slot('2026-10-29T21:00:00Z', true),
        slot('2026-10-29T22:30:00Z', true),
        slot('2026-10-30T01:00:00Z', true),
        slot('2026-10-30T02:00:00Z', true),
      ],
    },
  ],
};

describe('nextFreeStarts', () => {
  it('gives the next three distinct free times on the venue clock', () => {
    expect(nextFreeStarts(AVAILABILITY, NOW)).toEqual([
      {
        time: '18:00',
        startsAt: '2026-10-29T21:00:00Z',
        fieldId: 'b',
        durationMinutes: 30,
      },
      {
        time: '19:30',
        startsAt: '2026-10-29T22:30:00Z',
        fieldId: 'a',
        durationMinutes: 60,
      },
      {
        time: '22:00',
        startsAt: '2026-10-30T01:00:00Z',
        fieldId: 'b',
        durationMinutes: 30,
      },
    ]);
  });

  it('gives nothing when every time is taken or past', () => {
    expect(
      nextFreeStarts(AVAILABILITY, Date.parse('2026-10-31T00:00:00Z')),
    ).toEqual([]);
  });
});

describe('freeStartHref', () => {
  it('builds the venue link with the choice the page reads back', () => {
    expect(
      freeStartHref('arena', '2026-10-29', {
        time: '18:00',
        startsAt: '2026-10-29T21:00:00Z',
        fieldId: 'b',
        durationMinutes: 30,
      }),
    ).toBe(
      '/espacos/arena?data=2026-10-29&quadra=b&inicio=2026-10-29T21%3A00%3A00Z&duracao=30',
    );
  });
});
