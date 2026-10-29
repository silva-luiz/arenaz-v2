'use client';

import { ErrorState } from '@/components/ui/error-state';

/** Keeps the panel header (the layout) and only replaces the page. */
export default function PainelError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <ErrorState reset={reset} backHref="/painel" backLabel="Meus espaços" />
  );
}
