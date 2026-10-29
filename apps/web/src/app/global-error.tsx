'use client';

import { Button, Card } from '@arenaz/ui';
import './globals.css';

/**
 * Last resort: replaces the root layout, so it brings its own <html> and the
 * stylesheet. No router or Link here, the app shell may be what failed.
 */
export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-8 px-4 py-10">
          <Card>
            <h1 className="text-2xl font-bold tracking-tight">
              Algo deu errado
            </h1>
            <p className="mt-2 mb-6 text-muted">
              Não foi possível carregar esta página. Tente de novo.
            </p>
            <Button className="w-full" onClick={reset}>
              Tentar de novo
            </Button>
          </Card>
        </main>
      </body>
    </html>
  );
}
