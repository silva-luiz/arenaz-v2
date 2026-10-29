import { fieldSchema } from '@arenaz/contracts';
import { Card } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BlocksEditor } from '@/components/owner/blocks-editor';
import { DeleteButton } from '@/components/owner/delete-button';
import { FieldForm } from '@/components/owner/field-form';
import { PriceRulesEditor } from '@/components/owner/price-rules-editor';
import { apiGet } from '@/lib/api';

export const metadata: Metadata = { title: 'Quadra' };

export default async function QuadraPage({
  params,
}: {
  params: Promise<{ fieldId: string }>;
}) {
  const { fieldId } = await params;
  const field = await apiGet(
    `/owner/fields/${encodeURIComponent(fieldId)}`,
    fieldSchema,
    `/painel/quadras/${fieldId}`,
  );
  const venuePath = `/painel/espacos/${field.venueId}` as const;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={venuePath}
          className="text-sm font-semibold text-brand underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Voltar ao espaço
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{field.name}</h1>
      </div>

      <Card aria-labelledby="quadra-dados">
        <h2 id="quadra-dados" className="sr-only">
          Dados da quadra
        </h2>
        <FieldForm venueId={field.venueId} field={field} />
      </Card>

      <Card aria-labelledby="quadra-precos">
        <h2 id="quadra-precos" className="mb-1 text-lg font-bold">
          Faixas de preço
        </h2>
        <p className="mb-4 text-sm text-muted">
          Fora das faixas vale o preço base.
        </p>
        <PriceRulesEditor fieldId={field.id} initialRules={field.priceRules} />
      </Card>

      <Card aria-labelledby="quadra-bloqueios">
        <h2 id="quadra-bloqueios" className="mb-1 text-lg font-bold">
          Bloqueios
        </h2>
        <p className="mb-4 text-sm text-muted">
          Períodos em que a quadra não pode ser reservada. Horário de São Paulo.
        </p>
        <BlocksEditor fieldId={field.id} initialBlocks={field.blocks} />
      </Card>

      <Card aria-labelledby="quadra-excluir">
        <h2 id="quadra-excluir" className="mb-4 text-lg font-bold">
          Excluir quadra
        </h2>
        <DeleteButton
          label="Excluir quadra"
          warning="Excluir a quadra apaga também as faixas de preço e os bloqueios. Esta ação não pode ser desfeita."
          path={`/owner/fields/${field.id}`}
          redirectTo={venuePath}
        />
      </Card>
    </div>
  );
}
