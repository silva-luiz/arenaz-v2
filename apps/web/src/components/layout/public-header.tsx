'use client';

import { SiteHeader, type SiteHeaderNavItem } from '@arenaz/ui';
import { usePathname } from 'next/navigation';
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
 * leads everywhere).
 */
export function PublicHeader({ user }: { user: { name: string } | null }) {
  const pathname = usePathname();
  return (
    <SiteHeader
      user={user}
      nav={sections()}
      linkComponent={AppLink}
      className={pathname === '/' ? 'max-md:hidden' : undefined}
    />
  );
}
