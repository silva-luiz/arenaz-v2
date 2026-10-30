import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CourtList,
  courtFacts,
  formatMeasures,
  formatMinSlot,
  venueFacts,
  venueHeadline,
} from './court-list';
import { makeField, makeVenue } from '@/test/venue-fixture';

const SECOND_ID = '11111111-1111-4111-8111-111111111112';

describe('formatMeasures', () => {
  it('writes length by width in meters', () => {
    expect(formatMeasures(40, 20)).toBe('40 × 20 m');
  });

  it('uses a decimal comma', () => {
    expect(formatMeasures(40.5, 20)).toBe('40,5 × 20 m');
    expect(formatMeasures(25, 12.5)).toBe('25 × 12,5 m');
  });

  it('is left out unless both measures are known', () => {
    expect(formatMeasures(null, 20)).toBeNull();
    expect(formatMeasures(40, null)).toBeNull();
    expect(formatMeasures(null, null)).toBeNull();
  });
});

describe('formatMinSlot', () => {
  it('uses hours when they are whole', () => {
    expect(formatMinSlot(60)).toBe('Mínimo de 1 hora');
    expect(formatMinSlot(120)).toBe('Mínimo de 2 horas');
  });

  it('uses minutes otherwise', () => {
    expect(formatMinSlot(30)).toBe('Mínimo de 30 min');
    expect(formatMinSlot(90)).toBe('Mínimo de 90 min');
  });
});

describe('courtFacts', () => {
  it('lists sports, surface, format, measures and minimum slot', () => {
    expect(
      courtFacts(makeField({ sports: ['futebol_society', 'futsal'] })),
    ).toEqual([
      'Society, Futsal',
      'Grama sintética',
      '7x7',
      '40 × 20 m',
      'Mínimo de 1 hora',
    ]);
  });

  it('skips the format and the measures when they are unknown', () => {
    expect(
      courtFacts(
        makeField({
          format: null,
          lengthM: null,
          widthM: 10.5,
          sports: ['padel'],
        }),
      ),
    ).toEqual(['Padel', 'Grama sintética', 'Mínimo de 1 hora']);
  });
});

describe('CourtList', () => {
  it('shows each court with its name, facts and price', () => {
    render(
      <CourtList
        fields={[
          makeField(),
          makeField({
            id: SECOND_ID,
            name: 'Quadra 2',
            sports: ['padel'],
            basePriceCentsPerHour: 9050,
          }),
        ]}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [first, second] = items;
    if (!first || !second) throw new Error('two courts expected');
    expect(
      within(first).getByRole('heading', { name: 'Quadra 1', level: 3 }),
    ).toBeInTheDocument();
    expect(first).toHaveTextContent('40 × 20 m');
    expect(first).toHaveTextContent('R$ 180 / hora');
    expect(second).toHaveTextContent('R$ 90,50 / hora');
  });

  const rule = (priceCentsPerHour: number) => ({
    weekdays: [5, 6],
    startMinute: 1080,
    endMinute: 1380,
    priceCentsPerHour,
    label: null,
  });

  it('says "a partir de" with the lowest price when a rule is cheaper than the base', () => {
    render(
      <CourtList
        fields={[
          makeField({
            basePriceCentsPerHour: 18000,
            priceRules: [rule(25000), rule(15000)],
          }),
        ]}
      />,
    );

    const [court] = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.closest('li'));
    expect(court).toHaveTextContent('a partir de R$ 150 / hora');
    // The rules are still listed.
    expect(court).toHaveTextContent('Sex e Sáb, 18:00–23:00: R$ 250 / hora');
    expect(court).toHaveTextContent('Sex e Sáb, 18:00–23:00: R$ 150 / hora');
  });

  it('shows the plain base price when every rule is at or above it', () => {
    render(
      <CourtList
        fields={[
          makeField({
            basePriceCentsPerHour: 18000,
            priceRules: [rule(25000), rule(18000)],
          }),
          makeField({ id: SECOND_ID, name: 'Quadra 2' }),
        ]}
      />,
    );

    const [withRules, plain] = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.closest('li'));
    if (!withRules || !plain) throw new Error('two courts expected');
    expect(withRules).not.toHaveTextContent('a partir de');
    expect(withRules).toHaveTextContent('R$ 180 / hora');
    expect(withRules).toHaveTextContent(
      'Sex e Sáb, 18:00–23:00: R$ 250 / hora',
    );
    expect(plain).not.toHaveTextContent('a partir de');
  });

  it('renders nothing for a venue without courts', () => {
    const { container } = render(<CourtList fields={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('venueHeadline', () => {
  it('names the sport and format of a single court and the place', () => {
    expect(venueHeadline(makeVenue())).toBe(
      'Society 7x7 em Vila Madalena, São Paulo',
    );
  });

  it('leaves the format out when the court has none', () => {
    expect(
      venueHeadline(
        makeVenue({ fields: [makeField({ sports: ['padel'], format: null })] }),
      ),
    ).toBe('Padel em Vila Madalena, São Paulo');
  });

  it('counts the courts when there are several', () => {
    expect(
      venueHeadline(
        makeVenue({ fields: [makeField(), makeField({ id: SECOND_ID })] }),
      ),
    ).toBe('2 quadras em Vila Madalena, São Paulo');
  });

  it('still says where without courts', () => {
    expect(venueHeadline(makeVenue({ fields: [] }))).toBe(
      'Espaço em Vila Madalena, São Paulo',
    );
  });
});

describe('venueFacts', () => {
  it('lists surface, cover and size of a single court', () => {
    expect(venueFacts(makeVenue({ amenities: ['coberta', 'vestiario'] }))).toBe(
      'Grama sintética · coberta · 40 × 20 m',
    );
  });

  it('leaves out what is not known', () => {
    expect(
      venueFacts(
        makeVenue({ fields: [makeField({ lengthM: null })], amenities: [] }),
      ),
    ).toBe('Grama sintética');
  });

  it('lists the sports of several courts', () => {
    expect(
      venueFacts(
        makeVenue({
          amenities: [],
          fields: [
            makeField(),
            makeField({ id: SECOND_ID, sports: ['futsal', 'futebol_society'] }),
          ],
        }),
      ),
    ).toBe('Society, Futsal');
  });

  it('is empty without courts', () => {
    expect(venueFacts(makeVenue({ fields: [], amenities: [] }))).toBe('');
  });
});
