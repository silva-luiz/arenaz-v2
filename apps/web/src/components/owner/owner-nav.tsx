'use client';

import type { VenueSummary } from '@arenaz/contracts';
import { FOCUS_RING, LogoMark, cn } from '@arenaz/ui';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isDemoMode } from '@/lib/demo';
import { firstName } from '@/lib/owner-dashboard';

/** What the sidebar shows of a venue (a slice of the owner's venue list). */
export type OwnerNavVenue = Pick<
  VenueSummary,
  'id' | 'name' | 'fieldsCount' | 'coverUrl'
> &
  Partial<Pick<VenueSummary, 'coverSrcSet'>>;

export interface OwnerNavProps {
  /** The owner's venues; the one in the path (or the only one) is shown. */
  venues: readonly OwnerNavVenue[];
  ownerName: string;
}

// Icons of the prototype (Painel.dc.html `navDefs`).
const ICONS = {
  hoje: 'M3 12l9-8 9 8M5 10v10h14V10',
  agenda:
    'M5 4.5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM3 9.5h18M8 2.5v4M16 2.5v4',
  quadras: 'M3 6h18v12H3zM12 6v12M12 9.5a2.5 2.5 0 1 1 0 5',
  mensalistas:
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 12a2.5 2.5 0 1 0 0-5M16 14.6c2.7.1 4.8 1.8 5.5 4.9',
  financeiro:
    'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 10v4M18 10v4',
  avaliacoes:
    'M12 2l3.1 6.6 6.9.7-5.2 4.7 1.4 7-6.2-3.7-6.2 3.7 1.4-7L2 9.3l6.9-.7z',
  espacos: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  conta: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
} as const;

/** Features of the prototype that do not exist yet (shown only in the demo). */
const SOON = [
  { label: 'Mensalistas', icon: ICONS.mensalistas },
  { label: 'Financeiro', icon: ICONS.financeiro },
  { label: 'Avaliações', icon: ICONS.avaliacoes },
] as const;

const VENUE_PATH = /^\/painel\/espacos\/([0-9a-f-]{36})(?:\/|$)/i;

const ITEM =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-[11px] text-[15px] no-underline';

function Icon({ path }: { path: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

type Current = 'page' | 'true' | undefined;

function NavLink({
  href,
  icon,
  label,
  current,
}: {
  href: Route;
  icon: string;
  label: string;
  current: Current;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current}
        className={cn(
          ITEM,
          FOCUS_RING,
          'transition-colors duration-150 hover:bg-[#F2F2F2] motion-reduce:transition-none',
          current
            ? 'bg-[#F2F2F2] font-[650] text-ink'
            : 'font-medium text-[#4A4A4A]',
        )}
      >
        <Icon path={icon} />
        {label}
      </Link>
    </li>
  );
}

function courtsLabel(count: number): string {
  return `${String(count)} ${count === 1 ? 'quadra' : 'quadras'}`;
}

/**
 * The owner panel's sidebar (Painel.dc.html): logo with the "DONO" tag, the
 * sections and, at the bottom, the venue in context. A venue is in context
 * when the path names it, or when the owner has just one. Sections that do
 * not exist yet appear only in the demo, disabled.
 */
export function OwnerNav({ venues, ownerName }: OwnerNavProps) {
  const pathname = usePathname();
  const pathVenueId = VENUE_PATH.exec(pathname)?.[1];
  const venue =
    (pathVenueId
      ? venues.find((item) => item.id === pathVenueId)
      : undefined) ?? (venues.length === 1 ? venues[0] : undefined);

  const venuePath = venue ? `/painel/espacos/${venue.id}` : '';
  const agendaPath = `${venuePath}/agenda`;
  const onVenue = venue !== undefined && pathVenueId === venue.id;
  const courtsCurrent: Current = !onVenue
    ? undefined
    : pathname === venuePath
      ? 'page'
      : pathname.startsWith(`${venuePath}/quadras`)
        ? 'true'
        : undefined;

  return (
    <nav
      aria-label="Painel do dono"
      className="flex flex-col gap-1 border-b border-line bg-bg px-4 py-[22px] min-[880px]:sticky min-[880px]:top-0 min-[880px]:h-dvh min-[880px]:w-60 min-[880px]:shrink-0 min-[880px]:overflow-y-auto min-[880px]:border-r min-[880px]:border-b-0"
    >
      <div className="flex items-center gap-2 px-2.5 pb-[22px]">
        <Link
          href="/"
          aria-label="ArenaZ, início"
          className={cn(
            // 44px target on a phone; the prototype's 30px row from 880px.
            'flex min-h-11 items-center gap-2 rounded-button text-brand min-[880px]:min-h-0',
            FOCUS_RING,
          )}
        >
          <LogoMark size={30} />
          <span
            aria-hidden="true"
            className="font-wordmark text-[22px] font-extrabold tracking-[-0.045em]"
          >
            arenaz
          </span>
        </Link>
        <span className="rounded-md bg-ink px-[7px] py-[3px] text-[11px] font-bold tracking-[0.04em] text-white">
          DONO
        </span>
      </div>

      <ul className="flex flex-col gap-1">
        {venue ? (
          <>
            <NavLink
              href={agendaPath as Route}
              icon={ICONS.hoje}
              label="Hoje"
              current={pathname === agendaPath ? 'page' : undefined}
            />
            <NavLink
              href={`${agendaPath}#agenda` as Route}
              icon={ICONS.agenda}
              label="Agenda"
              current={undefined}
            />
            <NavLink
              href={`${venuePath}#espaco-quadras` as Route}
              icon={ICONS.quadras}
              label="Quadras"
              current={courtsCurrent}
            />
          </>
        ) : null}
        {isDemoMode
          ? SOON.map(({ label, icon }) => (
              <li key={label}>
                <button
                  type="button"
                  disabled
                  title="Em breve"
                  className={cn(
                    ITEM,
                    'cursor-not-allowed font-medium text-[#4A4A4A] opacity-60',
                  )}
                >
                  <Icon path={icon} />
                  {label} <span className="sr-only">(em breve)</span>
                </button>
              </li>
            ))
          : null}
        <NavLink
          href="/painel"
          icon={ICONS.espacos}
          label="Meus espaços"
          current={
            pathname === '/painel'
              ? 'page'
              : pathname === '/painel/espacos/novo'
                ? 'true'
                : undefined
          }
        />
        <NavLink
          href="/conta"
          icon={ICONS.conta}
          label="Conta"
          current={undefined}
        />
      </ul>

      {venue ? (
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-surface p-3.5 max-[879px]:mt-3">
          {venue.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- venue photos are served by the API/storage, with variants
            <img
              src={venue.coverUrl}
              srcSet={venue.coverSrcSet ?? undefined}
              sizes="44px"
              alt=""
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-bg">
              <LogoMark size={28} />
            </span>
          )}
          <span className="min-w-0 text-[13px]">
            <strong className="block font-[650]">{venue.name}</strong>
            <span className="text-muted">
              {[courtsLabel(venue.fieldsCount), firstName(ownerName)]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </div>
      ) : null}
    </nav>
  );
}
