'use client';

import type { PublicVenueCard } from '@arenaz/contracts';
import { FOCUS_RING, cn } from '@arenaz/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppLink } from '@/components/ui/next-link';
import { HomeVenueCard } from './home-venue-card';
import { RAIL_CARD_SIZES } from './styles';

export interface RailSectionProps {
  title: string;
  /** Where the heading leads (the search behind the rail). */
  href: string;
  items: readonly PublicVenueCard[];
  /** "Anteriores" / "Próximos" beside the heading (from md up). */
  arrows?: boolean | undefined;
  className?: string | undefined;
}

/*
 * Columns of the prototype's `.az-rail`: 78% (peek of the next card) on
 * mobile, 3 per view up to 1100px, 6 per view above; gap 22px.
 */
const RAIL =
  'grid grid-flow-col auto-cols-[78%] gap-[22px] overflow-x-auto overscroll-x-contain snap-x snap-mandatory px-1 pt-1.5 pb-7 -mb-[22px] -mx-1 [scrollbar-width:none] md:auto-cols-[calc((100%-44px)/3)] min-[68.8125rem]:auto-cols-[calc((100%-110px)/6)] [&::-webkit-scrollbar]:hidden';

function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points={back ? '15 6 9 12 15 18' : '9 6 15 12 9 18'} />
    </svg>
  );
}

const ARROW = cn(
  'grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-bg text-ink shadow-1 transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-px hover:shadow-2 disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  FOCUS_RING,
);

/** A titled, horizontally scrolling row of venue cards (Main.dc.html). */
export function RailSection({
  title,
  href,
  items,
  arrows = false,
  className,
}: RailSectionProps) {
  const headingId = useId();
  const railRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setEdges({
      start: rail.scrollLeft <= 1,
      end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure the edges when the items change
  useEffect(() => {
    measure();
  }, [measure, items]);

  function page(direction: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    rail.scrollBy({
      left: direction * rail.clientWidth,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <AppLink
          href={href}
          className={cn(
            'flex items-center gap-1.5 rounded-button text-ink',
            FOCUS_RING,
          )}
        >
          <h2
            id={headingId}
            className="text-xl font-semibold tracking-[-0.02em] md:text-2xl"
          >
            {title}
          </h2>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </AppLink>
        {arrows ? (
          <div className="flex gap-2 max-md:hidden">
            <button
              type="button"
              aria-label="Anteriores"
              disabled={edges.start}
              onClick={() => {
                page(-1);
              }}
              className={ARROW}
            >
              <Chevron back />
            </button>
            <button
              type="button"
              aria-label="Próximos"
              disabled={edges.end}
              onClick={() => {
                page(1);
              }}
              className={ARROW}
            >
              <Chevron />
            </button>
          </div>
        ) : null}
      </div>
      <ul
        ref={railRef}
        role="list"
        aria-labelledby={headingId}
        onScroll={measure}
        className={RAIL}
      >
        {items.map((venue) => (
          <li key={venue.slug} className="min-w-0 snap-start">
            <HomeVenueCard venue={venue} imageSizes={RAIL_CARD_SIZES} />
          </li>
        ))}
      </ul>
    </section>
  );
}
