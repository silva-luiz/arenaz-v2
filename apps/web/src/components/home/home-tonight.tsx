'use client';

import {
  publicSearchResponseSchema,
  type PublicVenueCard,
} from '@arenaz/contracts';
import { Alert, EmptyState, FOCUS_RING, Skeleton, cn } from '@arenaz/ui';
import { type ReactNode, useState } from 'react';
import { AppLink } from '@/components/ui/next-link';
import { apiSend } from '@/lib/api-client';
import { FreeNowCard } from './free-now-card';
import {
  DEFAULT_HOME_SPORT,
  HOME_SPORTS,
  homeSportQuery,
  type HomeSport,
} from './home-sports';
import { RailSection } from './rail-section';
import { pickTonight, type FreeStarts } from './tonight';

export interface HomeTonightProps {
  /** Venues of the default pick (Society); `null` when the API failed. */
  initialItems: PublicVenueCard[] | null;
  /** Next free times of the default pick's first venue. */
  initialStarts: FreeStarts | null;
}

type Loaded = PublicVenueCard[] | 'error';

const LOAD_ERROR = 'Não foi possível carregar os espaços agora.';

function SearchPill({ pick }: { pick: HomeSport }) {
  return (
    <AppLink
      href={`/buscar?${homeSportQuery(pick)}`}
      className={cn(
        'flex h-[60px] items-center gap-3.5 rounded-full bg-bg pr-2.5 pl-[22px] text-ink shadow-2 md:hidden',
        FOCUS_RING,
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <span className="min-w-0 flex-1">
        <strong className="block text-[15px] font-semibold">Bora jogar?</strong>{' '}
        <span className="block truncate text-xs text-muted">
          {`Qualquer lugar · hoje · ${pick.label}`}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="10" y1="17" x2="14" y2="17" />
        </svg>
      </span>
    </AppLink>
  );
}

function SportPicker({
  selected,
  onPick,
}: {
  selected: HomeSport;
  onPick: (pick: HomeSport) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Esportes"
      className="-mx-4 flex gap-[22px] overflow-x-auto border-b border-line px-4 pt-3.5 [scrollbar-width:none] md:mx-0 md:justify-center md:gap-[30px] md:border-b-0 md:px-0 md:pt-[76px] [&::-webkit-scrollbar]:hidden"
    >
      {HOME_SPORTS.map((pick) => {
        const on = pick.id === selected.id;
        return (
          <button
            key={pick.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              onPick(pick);
            }}
            className={cn(
              'group flex min-w-11 shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-button pb-3 text-xs md:gap-2.5 md:px-1 md:pt-1 md:pb-2 md:text-[13px]',
              FOCUS_RING,
              on
                ? 'font-semibold text-ink shadow-[inset_0_-2px_0_#161616] md:shadow-none'
                : 'font-medium text-muted hover:text-ink',
            )}
          >
            {/* biome-ignore lint/performance/noImgElement: static file in /public, already sized for this slot */}
            <img
              src={pick.image}
              alt=""
              width={64}
              height={64}
              className={cn(
                'size-10 rounded-xl object-cover transition-[transform,box-shadow,opacity] duration-300 ease-out motion-reduce:transition-none md:size-16 md:rounded-[18px]',
                on
                  ? 'md:-translate-y-[3px] md:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_var(--color-brand),0_18px_30px_-14px_rgba(8,36,24,0.6)] motion-reduce:md:translate-y-0'
                  : 'md:opacity-[0.86] md:shadow-1 md:group-hover:-translate-y-[3px] md:group-hover:shadow-2 motion-reduce:md:group-hover:translate-y-0',
              )}
            />
            {pick.label}
          </button>
        );
      })}
    </div>
  );
}

function RailSkeleton() {
  return (
    <div role="status" aria-label="Carregando espaços" aria-busy="true">
      <Skeleton className="mb-3.5 h-7 w-72 max-w-full rounded-button" />
      <div className="grid grid-flow-col auto-cols-[78%] gap-[22px] overflow-hidden md:auto-cols-[calc((100%-44px)/3)] min-[68.8125rem]:auto-cols-[calc((100%-110px)/6)]">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} className="aspect-square rounded-photo" />
        ))}
      </div>
    </div>
  );
}

/**
 * The sport row and what it drives: the "livre hoje à noite" rail (desktop)
 * and the big "Livre agora" card (mobile, MobileHome.dc.html), plus the
 * mobile "Bora jogar?" pill. The default pick comes from the server; another
 * pick is loaded once through the same-origin API and kept.
 */
export function HomeTonight({ initialItems, initialStarts }: HomeTonightProps) {
  const [pick, setPick] = useState<HomeSport>(DEFAULT_HOME_SPORT);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({
    [DEFAULT_HOME_SPORT.id]: initialItems ?? 'error',
  });

  function choose(next: HomeSport) {
    setPick(next);
    const known = loaded[next.id];
    if (known !== undefined && known !== 'error') return;
    setLoaded((current) => {
      const copy = { ...current };
      Reflect.deleteProperty(copy, next.id);
      return copy;
    });
    void apiSend(
      'GET',
      `/venues?${homeSportQuery(next)}`,
      undefined,
      publicSearchResponseSchema,
    ).then((result) => {
      setLoaded((current) => ({
        ...current,
        [next.id]: result.ok ? result.data.items : 'error',
      }));
    });
  }

  const items = loaded[pick.id];
  const searchHref = `/buscar?${homeSportQuery(pick)}`;

  let content: ReactNode;
  if (items === undefined) {
    content = <RailSkeleton />;
  } else if (items === 'error') {
    content = <Alert tone="error">{LOAD_ERROR}</Alert>;
  } else if (items.length === 0) {
    content = (
      <EmptyState title={`Ainda não há espaços de ${pick.label} por aqui.`} />
    );
  } else {
    const tonight = pickTonight(items);
    const first = tonight.items[0] as PublicVenueCard;
    content = (
      <>
        <RailSection
          title={
            tonight.free
              ? `${pick.label} livre hoje à noite, perto de você`
              : `${pick.label} para reservar`
          }
          href={searchHref}
          items={tonight.items}
          arrows
          className="max-md:hidden"
        />
        <section aria-labelledby="livre-agora" className="md:hidden">
          <h2
            id="livre-agora"
            className="mb-3.5 text-xl font-semibold tracking-[-0.02em]"
          >
            {tonight.free
              ? 'Livre agora perto de você'
              : `${pick.label} para reservar`}
          </h2>
          <FreeNowCard venue={first} initial={initialStarts} />
        </section>
      </>
    );
  }

  return (
    <>
      <SearchPill pick={pick} />
      <SportPicker selected={pick} onPick={choose} />
      <div className="pt-[22px] md:pt-9">{content}</div>
    </>
  );
}
