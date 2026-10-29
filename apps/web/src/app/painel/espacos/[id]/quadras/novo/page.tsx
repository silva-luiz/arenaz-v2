import { venueSchema } from '@arenaz/contracts';
import { Card } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FieldForm } from '@/components/owner/field-form';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Nova quadra' };

export default async function NovaQuadraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Also the ownership check: another owner's venue is a 404 here.
  const venue = await apiGet(
    `/owner/venues/${encodeURIComponent(id)}`,
    venueSchema,
    `/painel/espacos/${id}/quadras/novo`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/painel/espacos/${venue.id}`}
          className="text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {`Voltar a ${venue.name}`}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Nova quadra</h1>
      </div>
      <Card>
        <FieldForm venueId={venue.id} />
      </Card>
    </div>
  );
}
