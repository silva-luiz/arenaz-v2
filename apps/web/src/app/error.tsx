'use client';

import { ErrorState } from '@/components/ui/error-state';
import { PageShell } from '@/components/ui/page-shell';

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <PageShell>
      <ErrorState reset={reset} />
    </PageShell>
  );
}
