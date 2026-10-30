import {
  PUBLIC_MAX_PAGE,
  PUBLIC_PAGE_SIZE,
  publicSearchResponseSchema,
  type PublicSearchResponse,
} from '@arenaz/contracts';
import { Alert, EmptyState, buttonClasses, cn } from '@arenaz/ui';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { ResultsList } from '@/components/public/results-list';
import { AppLink } from '@/components/ui/next-link';
import { publicGet, toSearchParams } from '@/lib/public-api';
import {
  SEARCH_PATH,
  apiQuery,
  parseSearch,
  saoPauloDate,
  searchHref,
  type RawSearchParams,
  type SearchParams,
} from '@/lib/search-query';

const DEFAULT_TITLE = 'Buscar quadras';

interface SearchPageProps {
  searchParams: Promise<RawSearchParams>;
}

function titleFor(q: string | undefined): string {
  return q ? `Quadras em ${q}` : DEFAULT_TITLE;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const parsed = parseSearch(await searchParams);
  // An invalid search has no trustworthy `q`: fall back to the plain title.
  if (!parsed.ok) return { title: DEFAULT_TITLE };

  const { q, page } = parsed.query;
  const title = titleFor(q);
  return { title: page > 1 ? `${title} · Página ${String(page)}` : title };
}

/** The page of results, or `null` when the API cannot be reached. */
async function loadResults(
  params: SearchParams,
): Promise<PublicSearchResponse | null> {
  // Date and players are only intent for the venue page: the API does not
  // know them, and they must not split its cache.
  const query = toSearchParams(apiQuery(params)).toString();
  try {
    // revalidate 0: `nextFreeTime`/`freeTimes` depend on the clock, so a cached
    // copy would offer a time that already passed.
    return await publicGet(
      query ? `/venues?${query}` : '/venues',
      publicSearchResponseSchema,
      { revalidate: 0 },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error('Não foi possível buscar os espaços', error);
    return null;
  }
}

/**
 * Venues counted up to this page. The API gives no total, so when there is
 * more the count is a lower bound ("Mais de N"), never a made-up number.
 */
function countLabel(shown: number, hasMore: boolean): string {
  if (hasMore) return `Mais de ${String(shown)} espaços`;
  return shown === 1 ? '1 espaço' : `${String(shown)} espaços`;
}

/** Venues of this page with a free time left today (`nextFreeTime`). */
function freeTodayLabel(count: number): string {
  return count === 1
    ? '1 quadra com horário livre hoje'
    : `${String(count)} quadras com horário livre hoje`;
}

/**
 * Body when there is no list to show (an error, nothing found): a centered
 * column. The list itself is full width, see `ResultsList`.
 */
function Column({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-4 pt-4 pb-12 md:px-10 md:pt-6">
      {children}
    </div>
  );
}

function Heading({
  title,
  page = 1,
  hidden = false,
}: {
  title: string;
  page?: number;
  /** Visible only to assistive technology (the prototype has no title). */
  hidden?: boolean;
}) {
  return (
    <h1
      className={cn(
        'font-wordmark text-3xl leading-tight font-extrabold tracking-[-0.04em] md:text-4xl',
        hidden && 'sr-only',
      )}
    >
      {title}
      {page > 1 ? (
        <span className="font-semibold text-muted">
          {' · '}Página {page}
        </span>
      ) : null}
    </h1>
  );
}

/*
 * The search bar (a compact pill that opens the form) and the filter pills
 * live in the sticky header (components/layout/public-header.tsx, read from
 * the URL), so this page only has the results, or what to say when there are
 * none.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Layout and page prerender side by side; wait for a real request so
  // `next build` never calls the API (same as the home).
  await connection();

  const parsed = parseSearch(await searchParams);
  const { params } = parsed;

  if (!parsed.ok) {
    return (
      <Column>
        <Heading title={DEFAULT_TITLE} />
        <Alert tone="error" className="mx-auto w-full max-w-4xl">
          {Object.values(parsed.messages).map((message) => (
            <span key={message} className="block">
              {message}
            </span>
          ))}
        </Alert>
        <p className="text-center">
          <AppLink
            href={SEARCH_PATH}
            className={buttonClasses({ variant: 'secondary' })}
          >
            Ver todos os espaços
          </AppLink>
        </p>
      </Column>
    );
  }

  const { q, page } = parsed.query;
  const results = await loadResults(params);

  if (results === null) {
    return (
      <Column>
        <Heading title={titleFor(q)} page={page} />
        <Alert tone="error">Não foi possível carregar os espaços agora.</Alert>
      </Column>
    );
  }

  if (results.items.length === 0) {
    return (
      <Column>
        <Heading title={titleFor(q)} page={page} />
        <EmptyState
          title="Nenhum espaço encontrado"
          description="Tente outro bairro ou esporte, tire algum filtro ou veja todos os espaços."
          action={
            <AppLink
              href={SEARCH_PATH}
              className={buttonClasses({ variant: 'primary' })}
            >
              Ver todos os espaços
            </AppLink>
          }
        />
      </Column>
    );
  }

  const shown = (page - 1) * PUBLIC_PAGE_SIZE + results.items.length;
  const freeToday = results.items.filter(
    (venue) => venue.nextFreeTime !== null,
  ).length;
  // The API refuses pages past the maximum, so the last one has no next link.
  const canLoadMore = results.hasMore && page < PUBLIC_MAX_PAGE;

  return (
    <ResultsList
      items={results.items}
      intent={{ data: params.data, jogadores: params.jogadores }}
      today={saoPauloDate(new Date())}
      header={
        <>
          <Heading title={titleFor(q)} page={page} hidden />
          <p className="text-sm">
            {freeToday > 0 ? (
              <>
                <span className="font-semibold">
                  {freeTodayLabel(freeToday)}
                </span>
                {' · '}
                <span className="text-muted">
                  {countLabel(shown, results.hasMore)}
                </span>
              </>
            ) : (
              <span className="font-semibold">
                {countLabel(shown, results.hasMore)}
              </span>
            )}
          </p>
        </>
      }
      footer={
        canLoadMore ? (
          <p className="mt-10 text-center">
            <AppLink
              href={searchHref(params, page + 1)}
              rel="next"
              className={buttonClasses({ variant: 'secondary' })}
            >
              Carregar mais
            </AppLink>
          </p>
        ) : null
      }
    />
  );
}
