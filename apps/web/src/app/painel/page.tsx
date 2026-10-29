import { venueSummarySchema, type VenueSummary } from '@arenaz/contracts';
import { Badge, Card, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Meus espaços' };

function courtsLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'quadra' : 'quadras'}`;
}

function VenueCard({ venue }: { venue: VenueSummary }) {
  return (
    <li>
      <Link
        href={`/painel/espacos/${venue.id}`}
        className="flex gap-4 rounded-card border border-line bg-bg p-4 shadow-1 transition-shadow duration-150 hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
      >
        <span className="relative size-20 shrink-0 overflow-hidden rounded-photo bg-surface">
          {venue.coverUrl ? (
            // Photos live in object storage on another origin, which
            // next/image would need configured to optimize; unoptimized skips it.
            <Image
              src={venue.coverUrl}
              alt=""
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
            />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate text-lg font-bold">{venue.name}</span>
          <span className="text-sm text-muted">{venue.city}</span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={venue.status === 'published' ? 'free' : 'neutral'}>
              {venue.status === 'published' ? 'Publicado' : 'Rascunho'}
            </Badge>
            <span className="text-sm text-muted">
              {courtsLabel(venue.fieldsCount)}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function PainelPage() {
  const venues = await apiGet(
    '/owner/venues',
    venueSummarySchema.array(),
    '/painel',
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Meus espaços</h1>
        <Link href="/painel/espacos/novo" className={buttonClasses()}>
          + Novo espaço
        </Link>
      </div>
      {venues.length === 0 ? (
        <Card>
          <p className="text-muted">Você ainda não cadastrou nenhum espaço.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </ul>
      )}
    </div>
  );
}
