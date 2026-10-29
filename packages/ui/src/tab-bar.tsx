import type { ReactNode } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';

export type TabBarItem = 'inicio' | 'buscar' | 'conta';

export interface TabBarProps {
  active: TabBarItem;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ITEMS: {
  id: TabBarItem;
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    id: 'inicio',
    label: 'Início',
    href: '/',
    icon: (
      <Icon>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10h14V10" />
      </Icon>
    ),
  },
  {
    id: 'buscar',
    label: 'Buscar',
    href: '/buscar',
    icon: (
      <Icon>
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </Icon>
    ),
  },
  {
    id: 'conta',
    label: 'Conta',
    href: '/conta',
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </Icon>
    ),
  },
];

/**
 * Mobile-only bottom navigation (hidden from 768px up). Fixed to the bottom
 * edge and padded by the device safe area. Pages that show it need bottom
 * padding of their own so the last content is not covered.
 */
export function TabBar({ active, linkComponent, className }: TabBarProps) {
  const Link = linkComponent ?? 'a';
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden',
        className,
      )}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="flex-1">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none',
                  FOCUS_RING,
                  'focus-visible:-outline-offset-4',
                  current ? 'text-brand' : 'text-muted',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
