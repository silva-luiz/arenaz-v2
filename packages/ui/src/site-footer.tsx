import { cn } from './cn';

const ITEMS = ['Termos', 'Privacidade (LGPD)', 'Ajuda'] as const;

export interface SiteFooterProps {
  /** Adds "Fotos: Unsplash" (the demo photos need the credit). */
  showPhotoCredit?: boolean | undefined;
  className?: string | undefined;
}

/**
 * The legal items are plain text on purpose: those pages do not exist yet, and
 * a dead `href="#"` is worse than no link. Turn them into links when they do.
 */
export function SiteFooter({ showPhotoCredit, className }: SiteFooterProps) {
  return (
    <footer className={cn('border-t border-line bg-surface', className)}>
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-6 text-sm text-muted md:px-10">
        <p>
          © {new Date().getFullYear()} ArenaZ
          {showPhotoCredit ? ' · Fotos: Unsplash' : null}
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
