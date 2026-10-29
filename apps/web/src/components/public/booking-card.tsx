'use client';

import type { BrazilTimezone } from '@arenaz/contracts';
import { Button, PriceTag } from '@arenaz/ui';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { SlotPicker, type PickerField } from '@/components/booking/slot-picker';
import type { BookingIntent } from '@/lib/booking-client';

const DESKTOP_QUERY = '(min-width: 1024px)';

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function desktopSnapshot(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DESKTOP_QUERY).matches
  );
}

/**
 * Whether the card is the wide (lg) one. The server and the first client
 * render say "no" (the bar), so hydration always matches.
 */
function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
}

/**
 * Bottom sheet on the native `<dialog>` (`showModal()`): the browser gives
 * the top layer, the inert page behind and the focus trap. Mount it to open,
 * unmount it to close. Esc and "Fechar" call `onClose`; the focus goes to
 * "Fechar" on open and back to the trigger on close.
 */
function BookingSheet({
  onClose,
  returnFocusRef,
  children,
}: {
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

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
    const returnTo = returnFocusRef.current ?? openerRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo?.focus();
    };
    // Mount/unmount only: the focus target is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-0 mt-auto h-[min(92dvh,48rem)] max-h-none w-full max-w-none overscroll-contain rounded-t-section bg-bg p-0 text-ink shadow-3 backdrop:bg-night/60 open:flex open:flex-col"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <h2 id={titleId} className="text-lg font-bold tracking-tight">
          Escolha o horário
        </h2>
        <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
        {children}
      </div>
    </dialog>
  );
}

/**
 * Booking box of the venue page.
 *
 * One element, two shapes. Below `lg` it is a bar that sticks to the bottom
 * of the page content, above the mobile tab bar (the tab bar is 56px + 1px
 * border + the device safe area; from `md` there is none): the price and an
 * "Escolher horário" button that opens the picker in a sheet. It is `sticky`,
 * not `fixed`: it is the last thing in the page's flow, so when the page ends
 * it settles above the footer and never covers content. From `lg` it is the
 * card of the right column, sticky below the header (81px), and the picker
 * sits in it. Render it as a direct child of the page's content wrapper:
 * `sticky` only moves inside its parent, and on a phone that must be the
 * whole page content.
 *
 * Focus must not hide under the bar (WCAG 2.4.11): the bar has a FIXED height,
 * the `--booking-bar-h` variable of `globals.css`, and the same variable feeds
 * the `scroll-padding-bottom` of `<html>` while a page with a `data-booking-bar`
 * element is shown (`html:has([data-booking-bar])`, below `lg`). The text may
 * wrap, but never grows the bar.
 */
export function BookingCard({
  slug,
  timezone,
  fields,
  minPriceCentsPerHour,
  signedIn,
  initial,
}: {
  slug: string;
  timezone: BrazilTimezone;
  fields: PickerField[];
  /** Lowest price among the courts (base or rule); `null` if there is none. */
  minPriceCentsPerHour: number | null;
  signedIn: boolean;
  /** A choice made before signing in; opens the sheet on a phone. */
  initial?: BookingIntent | undefined;
}) {
  const desktop = useIsDesktop();
  const [sheetOpen, setSheetOpen] = useState(
    () => signedIn && initial !== undefined,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const bookable = fields.length > 0;
  const picker = (
    <SlotPicker
      slug={slug}
      timezone={timezone}
      fields={fields}
      signedIn={signedIn}
      initial={initial}
    />
  );

  return (
    <aside
      aria-label="Reserva"
      data-booking-bar=""
      className="h-(--booking-bar-h) lg:h-auto sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-bg px-4 py-2 shadow-1 md:-mx-10 md:bottom-0 md:px-10 lg:col-start-2 lg:row-start-1 lg:top-28 lg:bottom-auto lg:mx-0 lg:max-h-[calc(100dvh-8rem)] lg:self-start lg:overflow-y-auto lg:rounded-card lg:border lg:p-6 lg:shadow-3"
    >
      <div className="flex h-full items-center justify-between gap-4 lg:flex-col lg:items-stretch lg:gap-4">
        <div className="min-w-0">
          {minPriceCentsPerHour === null ? null : (
            <PriceTag
              cents={minPriceCentsPerHour}
              from
              className="text-base lg:text-2xl"
            />
          )}
          {bookable ? null : (
            <p className="text-xs text-muted lg:text-sm">
              Este espaço ainda não tem quadras para reservar.
            </p>
          )}
        </div>

        {!bookable ? null : desktop ? (
          picker
        ) : (
          <Button
            ref={triggerRef}
            size="sm"
            aria-haspopup="dialog"
            onClick={() => {
              setSheetOpen(true);
            }}
            className="shrink-0"
          >
            Escolher horário
          </Button>
        )}
      </div>

      {bookable && !desktop && sheetOpen ? (
        <BookingSheet onClose={closeSheet} returnFocusRef={triggerRef}>
          {picker}
        </BookingSheet>
      ) : null}
    </aside>
  );
}
