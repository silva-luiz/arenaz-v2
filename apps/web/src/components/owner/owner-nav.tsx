'use client';

import { cn } from '@arenaz/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: { href: Route; label: string }[] = [
  { href: '/painel', label: 'Meus espaços' },
  { href: '/conta', label: 'Conta' },
];

export function OwnerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Painel do dono">
      <ul className="flex items-center gap-1">
        {ITEMS.map(({ href, label }) => {
          const exact = pathname === href;
          const inside = pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={exact ? 'page' : inside ? 'true' : undefined}
                className={cn(
                  'inline-flex h-10 items-center rounded-button px-3 text-sm font-semibold hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  exact || inside ? 'text-brand' : 'text-ink',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
