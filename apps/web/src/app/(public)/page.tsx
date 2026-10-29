import {
  publicSearchResponseSchema,
  SPORT_LABELS,
  SPORTS,
} from '@arenaz/contracts';
import {
  Alert,
  Chip,
  EmptyState,
  FOCUS_RING,
  SearchBar,
  VenueCard,
  cn,
} from '@arenaz/ui';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import { AppLink } from '@/components/ui/next-link';
import { publicGet } from '@/lib/public-api';

const TITLE = 'ArenaZ — reserve quadras perto de você';
const DESCRIPTION =
  'Encontre quadras de society, futsal, padel, beach tennis e mais perto de você e reserve na hora.';
const FEATURED_LIMIT = 8;

export const metadata: Metadata = {
  // `absolute`: the root template would otherwise append " · arenaz".
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'ArenaZ',
    url: '/',
  },
};

/** Newest published venues, or `null` when the API cannot be reached. */
async function loadFeatured() {
  try {
    const result = await publicGet('/venues', publicSearchResponseSchema);
    return result ? result.items.slice(0, FEATURED_LIMIT) : null;
  } catch (error) {
    unstable_rethrow(error);
    console.error('Não foi possível carregar os espaços em destaque', error);
    return null;
  }
}

// Mobile: peek of the next card (78%). Wider screens: 2, 3 and 4 per view.
const RAIL =
  'grid auto-cols-[78%] grid-flow-col gap-5 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scroll-px-2 rounded-photo px-2 pt-2 pb-8 sm:auto-cols-[calc((100%-1.25rem)/2)] md:auto-cols-[calc((100%-2.5rem)/3)] lg:auto-cols-[calc((100%-3.75rem)/4)]';

function FieldLines({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 400 280"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="6" width="388" height="268" rx="14" />
      <line x1="200" y1="6" x2="200" y2="274" />
      <circle cx="200" cy="140" r="52" />
      <rect x="6" y="80" width="64" height="120" />
      <rect x="330" y="80" width="64" height="120" />
    </svg>
  );
}

export default async function HomePage() {
  // The layout already makes this route dynamic (it reads the session cookie),
  // but Next renders layout and page side by side while prerendering: wait for
  // a real request so `next build` never calls the API.
  await connection();
  const featured = await loadFeatured();

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      <div>
        <div className="relative overflow-hidden rounded-section bg-night px-6 pt-12 pb-10 text-white md:px-14 md:pt-20 md:pb-32">
          <FieldLines className="absolute -right-10 bottom-0 hidden w-[520px] translate-y-1/4 -rotate-6 text-white opacity-10 md:block" />
          <div className="relative max-w-2xl">
            <h1 className="font-wordmark text-[44px] leading-[1.02] font-extrabold tracking-[-0.045em] md:text-[68px]">
              Bora jogar hoje à noite?
            </h1>
            <p className="mt-4 max-w-md text-lg text-white md:mt-5 md:text-xl">
              Reserve a quadra na hora e chame o time.
            </p>
          </div>
        </div>
        <div className="relative z-10 mx-auto mt-4 max-w-4xl md:-mt-12">
          <SearchBar />
        </div>
      </div>

      <section aria-labelledby="esportes">
        <h2
          id="esportes"
          className="text-2xl font-bold tracking-tight md:text-3xl"
        >
          Esportes
        </h2>
        <ul className="mt-5 flex flex-wrap gap-3">
          {SPORTS.map((sport) => (
            <li key={sport}>
              <Chip
                href={`/buscar?sport=${sport}`}
                linkComponent={AppLink}
                className="pl-3"
              >
                <span
                  aria-hidden="true"
                  className="-ml-1.5 grid size-7 place-items-center rounded-lg bg-night text-sm font-bold text-live"
                >
                  {SPORT_LABELS[sport].charAt(0)}
                </span>
                {SPORT_LABELS[sport]}
              </Chip>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="destaque">
        <h2
          id="destaque"
          className="text-2xl font-bold tracking-tight md:text-3xl"
        >
          Espaços em destaque
        </h2>
        <div className="mt-5">
          {featured === null ? (
            <Alert tone="error">
              Não foi possível carregar os espaços agora.
            </Alert>
          ) : featured.length === 0 ? (
            <EmptyState title="Ainda não há espaços publicados por aqui." />
          ) : (
            <ul
              role="list"
              tabIndex={0}
              aria-label="Espaços em destaque"
              className={cn(RAIL, FOCUS_RING)}
            >
              {featured.map((venue) => (
                <li key={venue.slug} className="snap-start">
                  <VenueCard
                    href={`/espacos/${venue.slug}`}
                    name={venue.name}
                    neighborhood={venue.neighborhood}
                    city={venue.city}
                    coverUrl={venue.coverUrl}
                    sports={venue.sports}
                    minPriceCentsPerHour={venue.minPriceCentsPerHour}
                    linkComponent={AppLink}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-labelledby="dono"
        className="relative overflow-hidden rounded-section bg-brand px-6 py-12 text-white md:px-14 md:py-16"
      >
        <FieldLines className="absolute -right-16 -bottom-10 hidden w-[460px] rotate-6 text-white opacity-15 md:block" />
        <div className="relative max-w-xl">
          <p className="text-base font-semibold">Para donos de quadra</p>
          <h2
            id="dono"
            className="font-wordmark mt-3 text-[34px] leading-[1.02] font-extrabold tracking-[-0.045em] md:text-5xl"
          >
            Quadra vazia às 15h também paga as contas.
          </h2>
          <p className="mt-4 text-base">
            Cadastre seu espaço, publique fotos e preços e apareça nas buscas.
          </p>
          <AppLink
            href="/painel"
            className="mt-7 inline-flex h-[54px] items-center rounded-button bg-white px-6 text-base font-semibold text-ink shadow-2 transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Anunciar minha quadra
          </AppLink>
        </div>
      </section>
    </div>
  );
}
