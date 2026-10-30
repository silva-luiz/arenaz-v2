'use client';

import { cn, FOCUS_RING } from '@arenaz/ui';
import { useDemoFavorites } from '@/lib/demo/use-demo-favorites';

/**
 * "Salvar" of Quadra.dc.html, on the demo favorites (memory only): render it
 * only in the demo mode, favorites do not exist otherwise.
 */
export function SaveButton({ slug }: { slug: string }) {
  const favorites = useDemoFavorites();
  const saved = favorites.isFavorite(slug);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        favorites.toggle(slug);
      }}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold underline underline-offset-[3px] transition-colors duration-150 hover:bg-surface motion-reduce:transition-none md:h-10',
        FOCUS_RING,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={saved ? 'var(--color-fav)' : 'none'}
        stroke={saved ? 'var(--color-fav)' : 'currentColor'}
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 2.9 1.4-1.8 2.9-2.9 5-2.9 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
      </svg>
      {saved ? 'Salvo' : 'Salvar'}
    </button>
  );
}
