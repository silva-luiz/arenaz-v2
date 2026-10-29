import { formatCents, venueSchema } from '@arenaz/contracts';
import { Badge, Card, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DeleteVenueButton } from '@/components/owner/delete-venue-button';
import { HoursEditor } from '@/components/owner/hours-editor';
import { PhotoUploader } from '@/components/owner/photo-uploader';
import { PublishToggle } from '@/components/owner/publish-toggle';
import { VenueForm } from '@/components/owner/venue-form';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Espaço' };

const BACK_LINK =
  'text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default async function EspacoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await apiGet(
    `/owner/venues/${encodeURIComponent(id)}`,
    venueSchema,
    `/painel/espacos/${id}`,
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/painel" className={BACK_LINK}>
          Meus espaços
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{venue.name}</h1>
          <Badge tone={venue.status === 'published' ? 'free' : 'neutral'}>
            {venue.status === 'published' ? 'Publicado' : 'Rascunho'}
          </Badge>
        </div>
        <div className="mt-4">
          <PublishToggle venueId={venue.id} status={venue.status} />
        </div>
      </div>

      <Card aria-labelledby="espaco-dados">
        <h2 id="espaco-dados" className="sr-only">
          Dados do espaço
        </h2>
        <VenueForm venue={venue} />
      </Card>

      <Card aria-labelledby="espaco-horario">
        <h2 id="espaco-horario" className="mb-4 text-lg font-bold">
          Horário de funcionamento
        </h2>
        <HoursEditor venueId={venue.id} initialHours={venue.hours} />
      </Card>

      <Card aria-labelledby="espaco-quadras">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="espaco-quadras" className="text-lg font-bold">
            Quadras
          </h2>
          <Link
            href={`/painel/espacos/${venue.id}/quadras/novo`}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            + Nova quadra
          </Link>
        </div>
        {venue.fields.length === 0 ? (
          <p className="text-muted">Nenhuma quadra cadastrada.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {venue.fields.map((field) => (
              <li key={field.id}>
                <Link
                  href={`/painel/quadras/${field.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="font-semibold">{field.name}</span>
                  <span className="flex items-center gap-3 text-sm text-muted">
                    {`${formatCents(field.basePriceCentsPerHour)} por hora`}
                    {field.isActive ? null : <Badge>Inativa</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="espaco-fotos">
        <h2 id="espaco-fotos" className="mb-4 text-lg font-bold">
          Fotos
        </h2>
        <PhotoUploader venueId={venue.id} photos={venue.photos} />
      </Card>

      <Card aria-labelledby="espaco-excluir">
        <h2 id="espaco-excluir" className="mb-4 text-lg font-bold">
          Excluir espaço
        </h2>
        <DeleteVenueButton venueId={venue.id} />
      </Card>
    </div>
  );
}
