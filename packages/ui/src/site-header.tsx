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

export interface SiteHeaderNavItem {
  label: string;
  href: string;
  /** Round photo beside the label (decorative). */
  imageUrl: string;
  current?: boolean | undefined;
  /** Small "Novo" tag over the photo. */
  isNew?: boolean | undefined;
}

export interface SiteHeaderProps {
  user: { name: string } | null;
  /** Section tabs in the middle of the bar, from md up ("Quadras"). */
  nav?: readonly SiteHeaderNavItem[] | undefined;
  /**
   * Small tag beside the logo (the owner panel passes "DONO"). It sits next to
   * the home link, not inside it, so the link keeps its own name.
   */
  badge?: string | undefined;
  /** Hide the "Anuncie sua quadra" link (it is pointless for an owner). */
  showOwnerCta?: boolean | undefined;
  /** Slot for the compact search (the home hero has the full one). */
  children?: ReactNode;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
}

const PILL_LINK = cn(
  'inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
  FOCUS_RING,
);

// The account pill of the prototype ("Menu e perfil"): lines icon + avatar.
const ACCOUNT_PILL = cn(
  'inline-flex h-[46px] shrink-0 items-center gap-3 rounded-full border border-line-strong bg-bg pr-1.5 pl-3.5 text-sm font-semibold text-ink shadow-[0_2px_8px_-4px_rgba(8,36,24,0.25)] transition-shadow duration-150 hover:shadow-1 motion-reduce:transition-none',
  FOCUS_RING,
);

function MenuLines() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function PersonIcon() {
  return (
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
  );
}

export function SiteHeader({
  user,
  nav,
  badge,
  showOwnerCta = true,
  children,
  linkComponent,
  className,
}: SiteHeaderProps) {
  const Link = linkComponent ?? 'a';
  const letters = user ? initials(user.name) : '';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-line bg-bg md:border-b-0',
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 md:h-[84px] md:gap-6 md:px-10">
        <div className="flex shrink-0 items-center gap-3 md:flex-1 md:basis-0">
          <Link
            href="/"
            aria-label="ArenaZ, início"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-button',
              FOCUS_RING,
            )}
          >
            <LogoMark />
            <span
              aria-hidden="true"
              className="font-wordmark text-[25px] font-extrabold tracking-[-0.045em] text-brand"
            >
              arenaz
            </span>
          </Link>
          {badge ? (
            <span className="shrink-0 rounded-md bg-ink px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-white">
              {badge}
            </span>
          ) : null}
        </div>

        {nav && nav.length > 0 ? (
          <nav
            aria-label="Principal"
            className="flex items-center gap-[30px] max-md:hidden"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2.5 px-0.5 py-2 text-[15px] transition-colors duration-150 motion-reduce:transition-none',
                  FOCUS_RING,
                  item.current
                    ? 'font-semibold text-ink shadow-[inset_0_-2px_0_#161616]'
                    : 'font-medium text-muted hover:text-ink',
                )}
              >
                <img
                  src={item.imageUrl}
                  alt=""
                  width={34}
                  height={34}
                  className="size-[34px] rounded-full object-cover shadow-[0_0_0_2px_#ffffff,0_4px_10px_-3px_rgba(8,36,24,0.45)]"
                />
                {item.label}
                {item.isNew ? (
                  <>
                    {' '}
                    <span className="absolute -top-1.5 left-[22px] rounded-md bg-ink px-1.5 py-[3px] text-[10px] font-bold text-white shadow-[0_3px_8px_-2px_rgba(0,0,0,0.4)]">
                      Novo
                    </span>
                  </>
                ) : null}
              </Link>
            ))}
          </nav>
        ) : null}

        {children ? (
          <div className="flex min-w-0 flex-1 justify-center">{children}</div>
        ) : null}

        <div className="flex shrink-0 items-center justify-end gap-1.5 md:flex-1 md:basis-0">
          {/* Short on mobile, full from md up. The aria-label always holds the
              whole phrase, which contains the visible text (WCAG 2.5.3). The space is
              a no-break one: a plain leading space is dropped inside the flex
              link. */}
          {showOwnerCta ? (
            <Link
              href="/painel"
              aria-label="Anuncie sua quadra"
              className={PILL_LINK}
            >
              Anuncie<span className="max-md:hidden">{'\u00a0sua quadra'}</span>
            </Link>
          ) : null}
          {user ? (
            <Link href="/reservas" className={cn(PILL_LINK, 'max-md:hidden')}>
              Minhas reservas
            </Link>
          ) : null}
          {user ? (
            <Link
              href="/conta"
              aria-label={letters ? `Minha conta (${letters})` : 'Minha conta'}
              className={ACCOUNT_PILL}
            >
              <MenuLines />
              <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">
                {letters ? (
                  <span aria-hidden="true">{letters}</span>
                ) : (
                  <PersonIcon />
                )}
              </span>
            </Link>
          ) : (
            <Link href="/entrar" className={ACCOUNT_PILL}>
              <MenuLines />
              Entrar
              <span className="grid size-8 place-items-center rounded-full bg-muted text-white">
                <PersonIcon />
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
