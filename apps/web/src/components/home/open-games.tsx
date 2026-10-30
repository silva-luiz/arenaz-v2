import { FOCUS_RING, cn, formatPrice } from '@arenaz/ui';
import { AppLink } from '@/components/ui/next-link';
import {
  demoMarketingCounters,
  demoOpenGames,
  isDemoMode,
  missingLabel,
  type DemoOpenGame,
} from '@/lib/demo';
import { LiveDot } from './live-dot';
import { FACE_TONES, WHITE_FOCUS_RING } from './styles';

/** Open games have no page of their own yet: every card leads to the search. */
const GAMES_HREF = '/buscar';

function photo(game: DemoOpenGame): string {
  return `/home/partidas/${game.photo}.jpg`;
}

function Faces({ players }: { players: readonly string[] }) {
  return (
    <span aria-hidden="true" className="flex items-center">
      {players.map((initials, index) => (
        <span
          key={initials}
          style={{ background: FACE_TONES[index % FACE_TONES.length] }}
          className="grid size-7 place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-[0_2px_6px_-2px_rgba(0,0,0,0.4)] not-first:-ml-2"
        >
          {initials}
        </span>
      ))}
    </span>
  );
}

/** Desktop: white card on the dark band (Main.dc.html `games`). */
function GameCard({ game }: { game: DemoOpenGame }) {
  return (
    <AppLink
      href={GAMES_HREF}
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-card bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.2),0_24px_48px_-24px_rgba(0,0,0,0.7)] transition-[transform,box-shadow] duration-[450ms] ease-out hover:-translate-y-1.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.2),0_40px_70px_-28px_rgba(0,0,0,0.75)] motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        WHITE_FOCUS_RING,
      )}
    >
      <span className="relative block aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
        <img
          src={photo(game)}
          alt={game.photoAlt}
          loading="lazy"
          decoding="async"
          className="block size-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.45),rgba(0,0,0,0)_50%)]"
        />
        <span className="az-glass-dark absolute bottom-3 left-3 rounded-[10px] border border-white/18 px-2.5 py-1.5 text-xs font-semibold text-white">
          {game.when}
        </span>
        <span className="absolute right-3 bottom-3 rounded-[10px] bg-white px-2.5 py-1.5 text-xs font-bold text-ink shadow-[0_6px_14px_-6px_rgba(0,0,0,0.5)]">
          {missingLabel(game.missingCount)}
        </span>
      </span>
      <span className="flex flex-col gap-3 px-4 pt-4 pb-[18px]">
        <span className="flex flex-col gap-0.5">
          <strong className="text-base font-semibold">{game.title}</strong>
          <span className="text-[13px] text-muted">{game.place}</span>
        </span>
        <span className="flex items-center justify-between gap-2.5">
          <Faces players={game.players} />
          <span className="text-sm">
            <strong className="font-semibold">
              {formatPrice(game.shareCents)}
            </strong>
            <span className="text-muted"> /pessoa</span>
          </span>
        </span>
      </span>
    </AppLink>
  );
}

/**
 * "Falta gente? Entra no jogo.": games with a booked court that still need
 * players. The feature does not exist yet, so the section is demo only
 * (fixtures in lib/demo): a dark band on desktop (Main.dc.html), a plain
 * scrolling row on mobile (MobileHome.dc.html). `#partidas` is the target of
 * the "Partidas" tabs.
 */
export function OpenGames() {
  if (!isDemoMode || demoOpenGames.length === 0) return null;

  return (
    <div id="partidas" className="scroll-mt-24">
      <section
        aria-labelledby="partidas-titulo"
        className="relative -mx-10 overflow-hidden rounded-[36px] bg-night bg-[image:radial-gradient(70%_90%_at_12%_-20%,rgba(200,255,220,0.20)_0%,rgba(200,255,220,0)_60%),radial-gradient(50%_70%_at_92%_-30%,rgba(200,255,220,0.12)_0%,rgba(200,255,220,0)_60%)] px-10 pt-11 pb-10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_30px_60px_-40px_rgba(8,36,24,0.9)] max-md:hidden"
      >
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 1000 400"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
        >
          <g fill="none" stroke="#FFFFFF" strokeWidth="2">
            <line x1="500" y1="0" x2="500" y2="400" />
            <circle cx="500" cy="200" r="70" />
            <rect x="-2" y="110" width="110" height="180" />
            <rect x="892" y="110" width="110" height="180" />
          </g>
        </svg>
        <div className="relative mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2.5 text-sm font-semibold text-[#8FF0B8]">
              <LiveDot />
              {`${String(demoMarketingCounters.openGames)} partidas abertas agora`}
            </p>
            <h2
              id="partidas-titulo"
              className="font-wordmark text-[40px] leading-none font-bold tracking-[-0.04em]"
            >
              Falta gente? Entra no jogo.
            </h2>
            <p className="mt-2.5 text-base text-white/70">
              Times com quadra reservada que precisam completar. Você paga só a
              sua parte.
            </p>
          </div>
          <AppLink
            href={GAMES_HREF}
            className={cn(
              'inline-flex h-11 items-center rounded-full border border-white/22 bg-white/6 px-[18px] text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/12 motion-reduce:transition-none',
              WHITE_FOCUS_RING,
            )}
          >
            Ver todas
          </AppLink>
        </div>
        <ul
          role="list"
          className="relative -mx-1 -mb-[22px] grid grid-flow-col auto-cols-[calc((100%-22px)/2)] gap-[22px] overflow-x-auto px-1 pt-1.5 pb-7 [scrollbar-width:none] min-[68.8125rem]:auto-cols-[calc((100%-66px)/4)] [&::-webkit-scrollbar]:hidden"
        >
          {demoOpenGames.map((game) => (
            <li key={game.id} className="min-w-0">
              <GameCard game={game} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="partidas-titulo-mobile" className="md:hidden">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            id="partidas-titulo-mobile"
            className="text-xl font-semibold tracking-[-0.02em]"
          >
            Falta gente
          </h2>
          <AppLink
            href={GAMES_HREF}
            className={cn(
              'inline-flex min-h-11 items-center text-sm font-semibold text-ink underline',
              FOCUS_RING,
            )}
          >
            Ver todas
          </AppLink>
        </div>
        <ul
          role="list"
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {demoOpenGames.map((game) => (
            <li key={game.id} className="w-60 shrink-0">
              <AppLink
                href={GAMES_HREF}
                className={cn(
                  'flex flex-col gap-2 rounded-2xl text-ink',
                  FOCUS_RING,
                )}
              >
                <span className="relative block h-[150px] overflow-hidden rounded-2xl shadow-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static file in /public, already sized for this slot */}
                  <img
                    src={photo(game)}
                    alt={game.photoAlt}
                    loading="lazy"
                    decoding="async"
                    className="block size-full object-cover"
                  />
                  <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-[rgba(22,22,22,0.82)] px-[9px] py-[5px] text-xs font-semibold text-white">
                    {game.when}
                  </span>
                </span>
                <span className="text-sm">
                  <strong className="block font-semibold">{game.title}</strong>
                  <span className="text-muted">
                    {`${missingLabel(game.missingCount)} · ${formatPrice(game.shareCents)}/pessoa`}
                  </span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
