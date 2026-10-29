'use client';

import { TabBar, type TabBarItem } from '@arenaz/ui';
import { usePathname } from 'next/navigation';
import { AppLink } from '@/components/ui/next-link';

function activeTab(pathname: string): TabBarItem {
  if (pathname === '/') return 'inicio';
  if (pathname === '/reservas' || pathname.startsWith('/reservas/')) {
    return 'reservas';
  }
  if (pathname === '/conta') return 'conta';
  // A venue page is part of the search flow.
  return 'buscar';
}

/** Mobile tab bar of the public pages; the active tab follows the URL. */
export function PublicTabBar() {
  return <TabBar active={activeTab(usePathname())} linkComponent={AppLink} />;
}
