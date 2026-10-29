import {
  PUBLIC_MAX_PAGE,
  PUBLIC_PAGE_SIZE,
  SPORTS,
  publicSearchResponseSchema,
  type PublicSearchResponse,
} from '@arenaz/contracts';
import { Alert, EmptyState, SearchBar, buttonClasses, cn } from '@arenaz/ui';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import { ResultsList } from '@/components/public/results-list';
import { SearchFilters } from '@/components/public/search-filters';
import { AppLink } from '@/components/ui/next-link';
import { publicGet, toSearchParams } from '@/lib/public-api';
import {
  SEARCH_PATH,
  apiQuery,
  parseSearch,
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
    return await publicGet(
      query ? `/venues?${query}` : '/venues',
      publicSearchResponseSchema,
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Layout and page prerender side by side; wait for a real request so
  // `next build` never calls the API (same as the home).
  await connection();

  const parsed = parseSearch(await searchParams);
  const { params } = parsed;
  const sport = SPORTS.find((candidate) => candidate === params.sport);

  // Filters the bar has no field for ride along as hidden inputs, so a new
  // search keeps the pills the user turned on.
  const carried: Record<string, string> = {};
  if (params.amenities) carried.amenities = params.amenities;
  if (params.maxPrice) carried.maxPrice = params.maxPrice;

  const search = (
    <SearchBar
      defaultQuery={params.q}
      defaultSport={sport}
      defaultDate={params.data}
      defaultPlayers={params.jogadores}
      extraFields={carried}
      className="mx-auto max-w-4xl"
    />
  );

  if (!parsed.ok) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
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
      </div>
    );
  }

  const { q, page } = parsed.query;
  const results = await loadResults(params);

  const heading = <Heading title={titleFor(q)} page={page} />;
  const filters = <SearchFilters params={params} />;

  if (results === null) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
        {filters}
        {heading}
        <Alert tone="error">Não foi possível carregar os espaços agora.</Alert>
      </div>
    );
  }

  if (results.items.length === 0) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
        {/* Kept: a filter that empties the results must be easy to undo. */}
        {filters}
        {heading}
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
      </div>
    );
  }

  const shown = (page - 1) * PUBLIC_PAGE_SIZE + results.items.length;
  const freeToday = results.items.filter(
    (venue) => venue.nextFreeTime !== null,
  ).length;
  // The API refuses pages past the maximum, so the last one has no next link.
  const canLoadMore = results.hasMore && page < PUBLIC_MAX_PAGE;

  return (
    <div className="pb-12">
      <ResultsList
        items={results.items}
        intent={{ data: params.data, jogadores: params.jogadores }}
        header={
          <div className="flex flex-col gap-4">
            {search}
            {filters}
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
          </div>
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
    </div>
  );
}
