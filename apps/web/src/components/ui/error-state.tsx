'use client';

import { Button, Card, buttonClasses } from '@arenaz/ui';
import Link from 'next/link';
import type { Route } from 'next';

export interface ErrorStateProps {
  /** Next's `reset()`: tries to render the segment again. */
  reset: () => void;
  /** Where the secondary link goes; the home page by default. */
  backHref?: Route;
  backLabel?: string;
}

/**
 * pt-BR "something went wrong" card for the error boundaries. It takes no
 * error: the message and stack of a failed request must never reach users.
 */
export function ErrorState({
  reset,
  backHref = '/',
  backLabel = 'Ir para o início',
}: ErrorStateProps) {
  return (
    <Card>
      <h1 className="text-2xl font-bold tracking-tight">Algo deu errado</h1>
      <p className="mt-2 mb-6 text-muted">
        Não foi possível carregar esta página. Tente de novo.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1" onClick={reset}>
          Tentar de novo
        </Button>
        <Link
          href={backHref}
          className={buttonClasses({
            variant: 'secondary',
            className: 'flex-1',
          })}
        >
          {backLabel}
        </Link>
      </div>
    </Card>
  );
}
