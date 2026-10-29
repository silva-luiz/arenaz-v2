'use client';

import {
  DEFAULT_TAB_BAR_ITEMS,
  TabBar,
  type TabBarItem,
  type TabBarLink,
} from '@arenaz/ui';
import { usePathname } from 'next/navigation';
import { AppLink } from '@/components/ui/next-link';
import { isDemoMode } from '@/lib/demo';

function activeTab(pathname: string): TabBarItem {
  if (pathname === '/reservas' || pathname.startsWith('/reservas/')) {
    return 'reservas';
  }
  if (pathname === '/conta') return 'perfil';
  // The home, the search and a venue page are all "Explorar".
  return 'explorar';
}

/**
 * "Partidas" points at the home's open games, which exist only in the demo
 * mode (MobileHome.dc.html also has "Favoritos", left out: there is no page
 * listing them).
 */
function tabs(): readonly TabBarLink[] {
  if (!isDemoMode) return DEFAULT_TAB_BAR_ITEMS;
  const [explorar, ...rest] = DEFAULT_TAB_BAR_ITEMS;
  return explorar
    ? [explorar, { id: 'partidas', href: '/#partidas' }, ...rest]
    : DEFAULT_TAB_BAR_ITEMS;
}

/** Mobile tab bar of the public pages; the active tab follows the URL. */
export function PublicTabBar() {
  return (
    <TabBar
      active={activeTab(usePathname())}
      items={tabs()}
      linkComponent={AppLink}
    />
  );
}
