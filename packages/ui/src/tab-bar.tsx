import type { ReactNode } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';

export type TabBarItem = 'explorar' | 'partidas' | 'reservas' | 'perfil';

export interface TabBarLink {
  id: TabBarItem;
  href: string;
}

export interface TabBarProps {
  /** The item of the current page; `null` marks none. */
  active: TabBarItem | null;
  /**
   * Destinations, in order. Default: Explorar (`/`), Reservas and Perfil
   * (`/conta`). "Partidas" only exists where the app has somewhere to send it.
   */
  items?: readonly TabBarLink[] | undefined;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

export const DEFAULT_TAB_BAR_ITEMS: readonly TabBarLink[] = [
  { id: 'explorar', href: '/' },
  { id: 'reservas', href: '/reservas' },
  { id: 'perfil', href: '/conta' },
];

// Icons and labels of the prototype (docs/design/prototipo/MobileHome.dc.html).
const ITEM_LOOK: Record<TabBarItem, { label: string; icon: string }> = {
  explorar: {
    label: 'Explorar',
    icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5',
  },
  partidas: {
    label: 'Partidas',
    icon: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 12a2.5 2.5 0 1 0 0-5M16 14.6c2.7.1 4.8 1.8 5.5 4.9',
  },
  reservas: {
    label: 'Reservas',
    icon: 'M5 4.5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM3 9.5h18M8 2.5v4M16 2.5v4',
  },
  perfil: {
    label: 'Perfil',
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c.8-4 4-6 8-6s7.2 2 8 6',
  },
};

function Icon({ path }: { path: string }): ReactNode {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * Mobile-only bottom navigation (hidden from 768px up), as in the prototype:
 * translucent white bar, icon over an 11px label. Fixed to the bottom edge
 * and padded by the device safe area. It renders its own `md:hidden` spacer
 * after the `<nav>` (bar height + safe area) so the page's last content is
 * never covered; render it as the last child of the page.
 *
 * The active item is marked by colour AND a heavier label weight (WCAG
 * 1.4.1), plus `aria-current="page"`.
 *
 * Focus and anchors must not end up under the fixed bar or the sticky
 * header either, so the app needs this global rule (mobile values; the header
 * is 64px + 1px border and the bar 56px + 1px border, from 768px up the
 * header is 84px and there is no bar):
 *
 *     html { scroll-padding-top: 65px;
 *            scroll-padding-bottom: calc(57px + env(safe-area-inset-bottom)); }
 *     @media (min-width: 768px) {
 *       html { scroll-padding-top: 84px; scroll-padding-bottom: 0; }
 *     }
 */
export function TabBar({
  active,
  items = DEFAULT_TAB_BAR_ITEMS,
  linkComponent,
  className,
}: TabBarProps) {
  const Link = linkComponent ?? 'a';
  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] md:hidden',
          className,
        )}
      >
        <ul className="mx-auto flex max-w-lg px-1.5">
          {items.map((item) => {
            const current = item.id === active;
            const look = ITEM_LOOK[item.id];
            return (
              <li key={item.id} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 rounded-button text-[11px] transition-colors duration-150 motion-reduce:transition-none',
                    FOCUS_RING,
                    'focus-visible:-outline-offset-4',
                    current
                      ? 'font-semibold text-brand'
                      : 'font-medium text-muted hover:text-ink',
                  )}
                >
                  <Icon path={look.icon} />
                  {look.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div
        aria-hidden="true"
        data-testid="tab-bar-spacer"
        className="h-[calc(3.5rem+1px+env(safe-area-inset-bottom))] md:hidden"
      />
    </>
  );
}
