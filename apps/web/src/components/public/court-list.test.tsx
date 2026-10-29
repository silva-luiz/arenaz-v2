import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CourtList,
  courtFacts,
  formatMeasures,
  formatMinSlot,
} from './court-list';
import { makeField } from './venue-fixture';

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

  it('says "a partir de" only for a court with price rules', () => {
    render(
      <CourtList
        fields={[
          makeField({
            priceRules: [
              {
                weekdays: [5, 6],
                startMinute: 1080,
                endMinute: 1380,
                priceCentsPerHour: 25000,
                label: null,
              },
            ],
          }),
          makeField({ id: SECOND_ID, name: 'Quadra 2' }),
        ]}
      />,
    );

    const [withRules, plain] = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.closest('li'));
    if (!withRules || !plain) throw new Error('two courts expected');
    expect(withRules).toHaveTextContent('a partir de');
    expect(withRules).toHaveTextContent('Sex e Sáb, 18h–23h: R$ 250 / hora');
    expect(plain).not.toHaveTextContent('a partir de');
  });

  it('renders nothing for a venue without courts', () => {
    const { container } = render(<CourtList fields={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
