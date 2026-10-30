'use client';

import { cn } from '@arenaz/ui';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * `<main>` of the public pages: the 1360px column, except on `/buscar`, whose
 * list and map are full width (the map runs to the edge of the screen, as in
 * Busca.dc.html) and which pads its own columns.
 */
export function PublicMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    // tabIndex -1: the skip link moves focus here; no ring for that.
    <main
      id="conteudo"
      tabIndex={-1}
      className={cn(
        'w-full flex-1 outline-none',
        pathname !== '/buscar' &&
          'mx-auto max-w-[1360px] px-4 pt-4 md:px-10 md:pt-6',
      )}
    >
      {children}
    </main>
  );
}
