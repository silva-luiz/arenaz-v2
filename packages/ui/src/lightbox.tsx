'use client';

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from './cn';

export interface LightboxPhoto {
  url: string;
  alt: string;
}

export interface LightboxProps {
  photos: LightboxPhoto[];
  /** Photo shown when the lightbox opens (it navigates on its own after). */
  index: number;
  onClose: () => void;
  /**
   * Element that gets focus back on close. Safari and Firefox on macOS do not
   * focus a button on mouse click, so `document.activeElement` at mount can be
   * the body; pass the trigger here to be independent of that. Falls back to
   * whatever had focus when the lightbox mounted.
   */
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
}

// Two-tone ring (ink inside, white outside) so it shows over both the night
// background and light photos; the transparent outline keeps a ring in
// forced-colors mode.
const ON_NIGHT_FOCUS =
  'focus-visible:outline-hidden focus-visible:shadow-[0_0_0_3px_var(--color-ink),0_0_0_6px_var(--color-bg)]';

const ROUND_BUTTON = cn(
  'grid size-12 place-items-center rounded-full bg-white text-ink shadow-2 transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
  ON_NIGHT_FOCUS,
);

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Full-screen photo viewer on the native `<dialog>` (`showModal()`): the
 * browser provides the top layer, the inert background and the focus trap.
 *
 * Mount it when it should be open and unmount it on `onClose` (Gallery does).
 * Esc and the "Fechar" button call `onClose`; a native `close` event (for
 * example the Android back gesture) does too. Focus moves to "Fechar" on
 * open and returns to whatever had it before on unmount. The page behind is
 * inert while the modal is open and the dialog uses `overscroll-contain`, so
 * scrolling does not leak to the body.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  returnFocusRef,
}: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const total = photos.length;
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(index, 0), Math.max(total - 1, 0)),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Kept in a ref so a StrictMode re-run does not overwrite the real opener.
    openerRef.current ??=
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    // The trigger is set before the lightbox mounts, so read it once here.
    const returnTo = returnFocusRef?.current ?? openerRef.current;
    return () => {
      // A modal dialog leaves the top layer when it leaves the DOM; only the
      // focus has to be handed back.
      returnTo?.focus();
    };
    // Mount/unmount only: the focus target is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback(
    (delta: number) => {
      setCurrent((value) => (value + delta + total) % total);
    },
    [total],
  );

  // On `document`, not on the dialog: clicking the photo (not focusable)
  // moves focus to the body, and a handler on the dialog would stop hearing
  // the keys. The modal's inert background means nothing else needs them.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    // A handler closer to the target already took the key, and a dialog that
    // was closed from outside (still mounted for a moment) has nothing to do.
    if (event.defaultPrevented || !dialogRef.current?.open) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(-1);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      onKey(event);
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, []);

  const photo = photos[current];
  if (!photo) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Galeria de fotos"
      onClose={onClose}
      className="m-0 size-full max-h-none max-w-none overscroll-contain bg-night p-0 text-white backdrop:bg-night open:flex open:flex-col"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8">
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm font-semibold"
        >
          {`${String(current + 1)} de ${String(total)}`}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={cn(
            'inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
            ON_NIGHT_FOCUS,
          )}
        >
          <Icon>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </Icon>
          Fechar
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-24">
        <img
          key={current}
          src={photo.url}
          alt={photo.alt}
          className="max-h-full max-w-full rounded-photo object-contain"
        />
        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => {
                go(-1);
              }}
              className={cn(ROUND_BUTTON, 'absolute left-3 md:left-8')}
            >
              <Icon>
                <polyline points="15 5 8 12 15 19" />
              </Icon>
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={() => {
                go(1);
              }}
              className={cn(ROUND_BUTTON, 'absolute right-3 md:right-8')}
            >
              <Icon>
                <polyline points="9 5 16 12 9 19" />
              </Icon>
            </button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
