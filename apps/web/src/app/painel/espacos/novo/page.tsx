import { Card } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VenueForm } from '@/components/owner/venue-form';

export const metadata: Metadata = { title: 'Novo espaço' };

export default function NovoEspacoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/painel"
          className="text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Meus espaços
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Novo espaço</h1>
      </div>
      <Card>
        <VenueForm />
      </Card>
    </div>
  );
}
