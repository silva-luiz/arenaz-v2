import {
  SPORT_LABELS,
  SURFACE_LABELS,
  type PublicField,
  type PublicVenue,
} from '@arenaz/contracts';
import { PriceTag } from '@arenaz/ui';
import { lowestPriceCents, summarizePriceRule } from '@/lib/price-rule-summary';

const MINUTES_PER_HOUR = 60;

const decimalFormat = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});

/** "40 × 20 m" (decimal comma: "40,5 × 20 m"); `null` unless both are known. */
export function formatMeasures(
  lengthM: number | null,
  widthM: number | null,
): string | null {
  if (lengthM === null || widthM === null) return null;
  return `${decimalFormat.format(lengthM)} × ${decimalFormat.format(widthM)} m`;
}

/** "Mínimo de 1 hora", "Mínimo de 2 horas", "Mínimo de 30 min". */
export function formatMinSlot(minutes: number): string {
  if (minutes % MINUTES_PER_HOUR === 0) {
    const hours = minutes / MINUTES_PER_HOUR;
    return `Mínimo de ${String(hours)} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  return `Mínimo de ${String(minutes)} min`;
}

/** What describes a court, in reading order; unknown parts are left out. */
export function courtFacts(field: PublicField): string[] {
  const measures = formatMeasures(field.lengthM, field.widthM);
  return [
    field.sports.map((sport) => SPORT_LABELS[sport]).join(', '),
    SURFACE_LABELS[field.surface],
    field.format,
    measures,
    formatMinSlot(field.minSlotMinutes),
  ].filter((fact): fact is string => fact !== null && fact !== '');
}

/**
 * The line under the venue's photos (Quadra.dc.html): "Society 7x7 em Vila
 * Madalena, São Paulo" for one court, "2 quadras em ..." for several.
 */
export function venueHeadline(
  venue: Pick<PublicVenue, 'fields' | 'neighborhood' | 'city'>,
): string {
  const place = `${venue.neighborhood}, ${venue.city}`;
  const [only, ...others] = venue.fields;
  if (!only) return `Espaço em ${place}`;
  if (others.length > 0) {
    return `${String(venue.fields.length)} quadras em ${place}`;
  }
  const sport = only.sports[0] ? SPORT_LABELS[only.sports[0]] : 'Quadra';
  return `${[sport, only.format].filter(Boolean).join(' ')} em ${place}`;
}

/**
 * The facts under the headline: surface, "coberta" and size of a single
 * court ("Grama sintética · coberta · 40 × 20 m"); the sports of several.
 */
export function venueFacts(
  venue: Pick<PublicVenue, 'fields' | 'amenities'>,
): string {
  const covered = venue.amenities.includes('coberta') ? 'coberta' : null;
  const [only, ...others] = venue.fields;
  if (!only) return '';
  const facts =
    others.length > 0
      ? [
          [...new Set(venue.fields.flatMap((field) => field.sports))]
            .map((sport) => SPORT_LABELS[sport])
            .join(', '),
          covered,
        ]
      : [
          SURFACE_LABELS[only.surface],
          covered,
          formatMeasures(only.lengthM, only.widthM),
        ];
  return facts.filter((fact): fact is string => Boolean(fact)).join(' · ');
}

/**
 * The courts of a venue: facts, price and the price rules in words. A court
 * whose cheapest rule is below its base price shows "a partir de" and that
 * lowest price; when every rule is at or above the base price, the base price
 * is shown as is (the rules only list the dearer hours).
 */
export function CourtList({ fields }: { fields: PublicField[] }) {
  if (fields.length === 0) return null;

  return (
    <ul role="list" className="flex flex-col gap-4">
      {fields.map((field) => {
        const lowest = lowestPriceCents(field);
        return (
          <li
            key={field.id}
            className="rounded-photo border border-line bg-bg p-5 shadow-1"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h3 className="text-lg font-semibold">{field.name}</h3>
              <PriceTag
                cents={lowest}
                from={lowest < field.basePriceCentsPerHour}
              />
            </div>
            <p className="mt-1 text-sm text-muted">
              {courtFacts(field).join(' · ')}
            </p>
            {field.priceRules.length > 0 ? (
              <ul role="list" className="mt-3 flex flex-col gap-1 text-sm">
                {field.priceRules.map((rule) => (
                  <li
                    key={`${rule.weekdays.join(',')}@${String(rule.startMinute)}-${String(rule.endMinute)}`}
                  >
                    {summarizePriceRule(rule)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
