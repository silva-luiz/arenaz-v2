import {
  PUBLIC_MAX_PAGE,
  PUBLIC_PAGE_SIZE,
  SPORTS,
  publicSearchResponseSchema,
  type PublicSearchResponse,
} from '@arenaz/contracts';
import { Alert, EmptyState, SearchBar, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';
import { ResultsList } from '@/components/public/results-list';
import { AppLink } from '@/components/ui/next-link';
import { publicGet, toSearchParams } from '@/lib/public-api';
import {
  SEARCH_PATH,
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
  const query = toSearchParams(params).toString();
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Layout and page prerender side by side; wait for a real request so
  // `next build` never calls the API (same as the home).
  await connection();

  const parsed = parseSearch(await searchParams);
  const { params } = parsed;
  const sport = SPORTS.find((candidate) => candidate === params.sport);

  const search = (
    <SearchBar
      defaultQuery={params.q}
      defaultSport={sport}
      className="mx-auto max-w-4xl"
    />
  );

  if (!parsed.ok) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
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

  const heading = (
    <h1 className="font-wordmark text-3xl leading-tight font-extrabold tracking-[-0.04em] md:text-4xl">
      {titleFor(q)}
      {page > 1 ? (
        <span className="font-semibold text-muted">
          {' · '}Página {page}
        </span>
      ) : null}
    </h1>
  );

  if (results === null) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
        {heading}
        <Alert tone="error">Não foi possível carregar os espaços agora.</Alert>
      </div>
    );
  }

  if (results.items.length === 0) {
    return (
      <div className="flex flex-col gap-6 pb-12">
        {search}
        {heading}
        <EmptyState
          title="Nenhum espaço encontrado"
          description="Tente outro bairro ou esporte, ou veja todos os espaços."
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
  // The API refuses pages past the maximum, so the last one has no next link.
  const canLoadMore = results.hasMore && page < PUBLIC_MAX_PAGE;

  return (
    <div className="pb-12">
      <ResultsList
        items={results.items}
        header={
          <div className="flex flex-col gap-6">
            {search}
            <div>
              {heading}
              <p className="mt-1 text-sm font-semibold">
                {countLabel(shown, results.hasMore)}
              </p>
            </div>
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
