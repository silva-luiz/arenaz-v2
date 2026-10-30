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
  const search = pathname === '/buscar';
  return (
    // tabIndex -1: the skip link moves focus here; no ring for that.
    <main
      id="conteudo"
      tabIndex={-1}
      // globals.css keys on it: the search page's sticky header is taller, so
      // the scroll padding that keeps focus clear of it is taller too.
      data-search-page={search ? '' : undefined}
      className={cn(
        'w-full flex-1 outline-none',
        !search && 'mx-auto max-w-[1360px] px-4 pt-4 md:px-10 md:pt-6',
      )}
    >
      {children}
    </main>
  );
}
