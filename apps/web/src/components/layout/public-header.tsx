'use client';

import { SiteHeader, type SiteHeaderNavItem } from '@arenaz/ui';
import { usePathname } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import {
  SearchHeaderFilters,
  SearchSummary,
} from '@/components/public/search-header';
import { AppLink } from '@/components/ui/next-link';
import { isDemoMode } from '@/lib/demo';

/**
 * The section tabs of Main.dc.html. Every public page is "Quadras"; the open
 * games ("Partidas", on the home) and "Mensalistas" (owner panel) are demo
 * only, like the features behind them.
 */
function sections(): SiteHeaderNavItem[] {
  const quadras: SiteHeaderNavItem = {
    label: 'Quadras',
    href: '/',
    imageUrl: '/home/nav-quadras.jpg',
    current: true,
  };
  if (!isDemoMode) return [quadras];
  return [
    quadras,
    {
      label: 'Partidas',
      href: '/#partidas',
      imageUrl: '/home/nav-partidas.jpg',
      isNew: true,
    },
    {
      label: 'Mensalistas',
      href: '/painel',
      imageUrl: '/home/nav-mensalistas.jpg',
    },
  ];
}

/**
 * Header of the public pages. On the mobile home it gives way to the
 * "Bora jogar?" search pill, as in MobileHome.dc.html (the tab bar still
 * leads everywhere). On `/buscar` it is the header of Busca.dc.html instead:
 * full width, no section tabs, the compact search pill in the middle and the
 * filter pills in a row under it, all in the same sticky block. On a venue
 * page it is the header of Quadra.dc.html: no section tabs, the compact search
 * pill (`venueSearch`, filled by the page's `@header` slot with the venue's
 * neighborhood, day and sport; from md, as the prototype hides it on a phone)
 * and a border; the wordmark stays on a phone.
 */
export function PublicHeader({
  user,
  venueSearch,
}: {
  user: { name: string } | null;
  /** The venue page's search pill (`@header` slot). */
  venueSearch?: ReactNode;
}) {
  const pathname = usePathname();
  const search = pathname === '/buscar';
  const venue = pathname.startsWith('/espacos/');
  const compact = search || venue;

  return (
    <SiteHeader
      user={user}
      nav={compact ? undefined : sections()}
      linkComponent={AppLink}
      className={pathname === '/' ? 'max-md:hidden' : undefined}
      fluid={search}
      bordered={compact}
      hideWordmarkOnPhone={search}
      hideOwnerCtaOnPhone={compact}
      belowRow={
        search ? (
          <Suspense fallback={<div className="h-[60px]" />}>
            <SearchHeaderFilters />
          </Suspense>
        ) : undefined
      }
    >
      {search ? (
        <Suspense fallback={null}>
          <SearchSummary />
        </Suspense>
      ) : venue && venueSearch ? (
        // Quadra.dc.html hides the pill below 760px (logo and account only).
        <div className="flex min-w-0 justify-center max-md:hidden">
          {venueSearch}
        </div>
      ) : null}
    </SiteHeader>
  );
}
