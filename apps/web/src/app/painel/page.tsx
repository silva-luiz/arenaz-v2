import { venueSummarySchema } from '@arenaz/contracts';
import { Card, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { OwnerVenueCard } from '@/components/owner/owner-venue-card';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Meus espaços' };

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
        <ul className="grid grid-cols-1 gap-x-6 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {venues.map((venue) => (
            <li key={venue.id}>
              <OwnerVenueCard venue={venue} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
