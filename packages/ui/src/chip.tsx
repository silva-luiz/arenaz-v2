import type { MouseEventHandler, ReactNode } from 'react';
import { cn } from './cn';
import { FOCUS_RING, type LinkComponent } from './link';

export interface ChipProps {
  /**
   * Selected state. On a button it is a toggle (`aria-pressed`); on a link
   * (`href`) it marks the current choice (`aria-current="true"`).
   */
  pressed?: boolean | undefined;
  onClick?: MouseEventHandler<HTMLElement> | undefined;
  /** Renders a link instead of a button. */
  href?: string | undefined;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
  children: ReactNode;
}

const BASE =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ease-out motion-reduce:transition-none';

// Border is --color-line-control (3:1 on white) so the pill boundary passes
// WCAG 1.4.11, like the form controls.
const IDLE = 'border-line-control bg-bg text-ink hover:bg-surface';
const SELECTED = 'border-ink bg-ink text-white';

/**
 * Filter pill: radius 999px, toggle button or link.
 *
 * Passing `onClick` makes the chip interactive, so the parent must be a client
 * component (a function prop cannot cross the server boundary). Server pages
 * should use the `href` form, which needs no JavaScript.
 */
export function Chip({
  pressed,
  onClick,
  href,
  linkComponent,
  className,
  children,
}: ChipProps) {
  const classes = cn(BASE, FOCUS_RING, pressed ? SELECTED : IDLE, className);

  if (href !== undefined) {
    const Link = linkComponent ?? 'a';
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={pressed ? 'true' : undefined}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={classes}
    >
      {children}
    </button>
  );
}
