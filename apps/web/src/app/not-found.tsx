import { Card, buttonClasses } from '@arenaz/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/ui/page-shell';

export const metadata: Metadata = { title: 'Página não encontrada' };

/**
 * Also what `notFound()` renders for another owner's resource: the text does
 * not say whether the address exists.
 */
export default function NotFound() {
  return (
    <PageShell>
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mt-2 mb-6 text-muted">
          O endereço não existe ou você não tem acesso a ele.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={buttonClasses({ className: 'flex-1' })}>
            Ir para o início
          </Link>
          <Link
            href="/painel"
            className={buttonClasses({
              variant: 'secondary',
              className: 'flex-1',
            })}
          >
            Meus espaços
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
