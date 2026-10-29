'use client';

import { AMENITY_LABELS, type Amenity } from '@arenaz/contracts';
import { Chip, cn } from '@arenaz/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { isDemoMode } from '@/lib/demo';
import {
  PRICE_CHIP_REAIS,
  amenitiesOf,
  searchHref,
  withAmenity,
  withMaxPrice,
  type SearchParams,
} from '@/lib/search-query';

type Filter =
  | { kind: 'amenity'; amenity: Amenity }
  | { kind: 'price' }
  /** In the prototype, but nothing behind it yet: shown disabled (demo). */
  | { kind: 'soon'; label: string };

// The prototype's order. The two "soon" filters exist only in the demo mode.
const FILTERS: readonly Filter[] = [
  { kind: 'soon', label: 'Reserva instantânea' },
  { kind: 'amenity', amenity: 'coberta' },
  { kind: 'amenity', amenity: 'vestiario' },
  { kind: 'amenity', amenity: 'estacionamento' },
  { kind: 'price' },
  { kind: 'soon', label: 'Aceita mensalista' },
];

const PRICE_LABEL = `Até R$ ${String(PRICE_CHIP_REAIS)}/h`;

// 44px target on a phone, the prototype's 40px from md (Tailwind emits `h-11`
// after the chip's own `h-10`, and `md:h-10` after both).
const CHIP_SIZE = 'h-11 md:h-10';

export interface SearchFiltersProps {
  /** The filters in the URL (already validated). */
  params: SearchParams;
}

/**
 * The filter pills under the search bar. Each real one is a toggle
 * (`aria-pressed`) that rewrites the URL (`amenities`, `maxPrice`), keeping
 * the rest of the search, and the page re-renders with the filtered results.
 * Pressed state comes from the URL, so it survives reload and sharing.
 */
export function SearchFilters({ params }: SearchFiltersProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: SearchParams) {
    startTransition(() => {
      router.push(searchHref(next, 1) as Route);
    });
  }

  const amenities = amenitiesOf(params);

  return (
    <div
      role="group"
      aria-label="Filtros"
      aria-busy={pending}
      className={cn(
        // Own scroll area: the row never widens the page. `relative` makes it
        // the containing block of the chips' `sr-only` text, which would
        // otherwise escape the clipping and widen the page. The padding keeps
        // the focus ring of the first and last chip from being cut.
        'relative -mx-1 flex gap-2 overflow-x-auto px-1 py-1',
        pending && 'opacity-70',
      )}
    >
      {FILTERS.map((filter) => {
        if (filter.kind === 'soon') {
          if (!isDemoMode) return null;
          return (
            <Chip
              key={filter.label}
              tone="soft"
              pressed={false}
              disabled
              title="Em breve"
              className={CHIP_SIZE}
            >
              {filter.label}
              <span className="sr-only"> (em breve)</span>
            </Chip>
          );
        }
        if (filter.kind === 'price') {
          const pressed = params.maxPrice === String(PRICE_CHIP_REAIS);
          return (
            <Chip
              key="price"
              tone="soft"
              pressed={pressed}
              className={CHIP_SIZE}
              onClick={() => {
                go(
                  withMaxPrice(params, pressed ? undefined : PRICE_CHIP_REAIS),
                );
              }}
            >
              {PRICE_LABEL}
            </Chip>
          );
        }
        const pressed = amenities.includes(filter.amenity);
        return (
          <Chip
            key={filter.amenity}
            tone="soft"
            pressed={pressed}
            className={CHIP_SIZE}
            onClick={() => {
              go(withAmenity(params, filter.amenity, !pressed));
            }}
          >
            {AMENITY_LABELS[filter.amenity]}
          </Chip>
        );
      })}
    </div>
  );
}
