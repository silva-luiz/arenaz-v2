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
  /**
   * `solid` (default) fills the selected chip with ink, as the date and
   * sport pickers do; `soft` is the prototype's filter pill: light fill and a
   * 2 px ink outline.
   */
  tone?: 'solid' | 'soft' | undefined;
  /** Button only. Native `disabled`: out of the tab order, no clicks. */
  disabled?: boolean | undefined;
  /** Tooltip, for instance the "Em breve" of a disabled filter. */
  title?: string | undefined;
  /** Renders a link instead of a button. */
  href?: string | undefined;
  linkComponent?: LinkComponent | undefined;
  className?: string | undefined;
  /** Longer accessible name; it must start with the visible text. */
  'aria-label'?: string | undefined;
  children: ReactNode;
}

const BASE =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ease-out motion-reduce:transition-none';

// Border is --color-line-control (3:1 on white) so the pill boundary passes
// WCAG 1.4.11, like the form controls.
const IDLE = 'border-line-control bg-bg text-ink hover:bg-surface';
const SELECTED = 'border-ink bg-ink text-white';
const SELECTED_SOFT =
  'border-ink bg-[#f2f2f2] text-ink shadow-[inset_0_0_0_1px_var(--color-ink)]';
const DISABLED = 'cursor-not-allowed opacity-55 hover:bg-bg';

/**
 * Filter pill: radius 999px, toggle button or link.
 *
 * Passing `onClick` makes the chip interactive, so the parent must be a client
 * component (a function prop cannot cross the server boundary). Server pages
 * should use the `href` form, which needs no JavaScript.
 */
export function Chip({
  pressed,
  tone = 'solid',
  disabled,
  title,
  onClick,
  href,
  linkComponent,
  className,
  'aria-label': ariaLabel,
  children,
}: ChipProps) {
  const selected = tone === 'soft' ? SELECTED_SOFT : SELECTED;
  const classes = cn(
    BASE,
    FOCUS_RING,
    pressed ? selected : IDLE,
    disabled && DISABLED,
    className,
  );

  if (href !== undefined) {
    const Link = linkComponent ?? 'a';
    return (
      <Link
        href={href}
        onClick={onClick}
        aria-current={pressed ? 'true' : undefined}
        aria-label={ariaLabel}
        title={title}
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
      aria-label={ariaLabel}
      disabled={disabled}
      title={title}
      className={classes}
    >
      {children}
    </button>
  );
}
