import type { ReactNode } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';
import { LogoMark } from './logo';

/** First letters of the first and last name tokens, uppercased. */
export function initials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0];
  const last = tokens.at(-1);
  if (!first || !last) return '';
  const letters =
    tokens.length === 1 ? first.charAt(0) : first.charAt(0) + last.charAt(0);
  return letters.toLocaleUpperCase('pt-BR');
}

export interface SiteHeaderProps {
  user: { name: string } | null;
  /** Slot for the compact search (the home hero has the full one). */
  children?: ReactNode;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

const PILL_LINK = cn(
  'inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
  FOCUS_RING,
);

export function SiteHeader({
  user,
  children,
  linkComponent,
  className,
}: SiteHeaderProps) {
  const Link = linkComponent ?? 'a';
  const letters = user ? initials(user.name) : '';

  return (
    <header
      className={cn('sticky top-0 z-40 border-b border-line bg-bg', className)}
    >
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 md:h-20 md:px-10">
        <Link
          href="/"
          aria-label="ArenaZ, início"
          className={cn(
            'flex shrink-0 items-center gap-2.5 rounded-button',
            FOCUS_RING,
          )}
        >
          <LogoMark />
          <span
            aria-hidden="true"
            className="font-wordmark text-2xl font-extrabold tracking-[-0.045em] text-ink"
          >
            arenaz
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 justify-center">{children}</div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Short on mobile, full from md up. The aria-label always holds the
              whole phrase, which contains the visible text (WCAG 2.5.3). */}
          <Link
            href="/painel"
            aria-label="Anuncie sua quadra"
            className={PILL_LINK}
          >
            Anuncie<span className="max-md:hidden">{' sua quadra'}</span>
          </Link>
          {user ? (
            <Link
              href="/conta"
              aria-label={letters ? `Minha conta (${letters})` : 'Minha conta'}
              className={cn(
                'grid size-11 place-items-center rounded-full bg-ink text-xs font-semibold text-white',
                FOCUS_RING,
              )}
            >
              {letters ? (
                <span aria-hidden="true">{letters}</span>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
                </svg>
              )}
            </Link>
          ) : (
            <Link
              href="/entrar"
              className={cn(PILL_LINK, 'border border-line-control')}
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
