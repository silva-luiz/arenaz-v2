import { Button, PriceTag } from '@arenaz/ui';

const NOTICE_ID = 'reserva-aviso';

/**
 * Booking box of the venue page. For now it only says booking is coming; the
 * time picker (Plano 3) takes the button's place.
 *
 * One element, two shapes. Below `lg` it is a bar that sticks to the bottom
 * of the page content, above the mobile tab bar (the tab bar is 56px + 1px
 * border + the device safe area; from `md` there is none). It is `sticky`,
 * not `fixed`: it is the last thing in the page's flow, so when the page ends
 * it settles above the footer and never covers content. From `lg` it is the
 * card of the right column, sticky below the header (81px). Render it as a
 * direct child of the page's content wrapper: `sticky` only moves inside its
 * parent, and on a phone that must be the whole page content.
 *
 * Focus must not hide under the bar (WCAG 2.4.11): the bar has a FIXED height,
 * the `--booking-bar-h` variable of `globals.css`, and the same variable feeds
 * the `scroll-padding-bottom` of `<html>` while a page with a `data-booking-bar`
 * element is shown (`html:has([data-booking-bar])`, below `lg`). The text may
 * wrap, but never grows the bar.
 *
 * The button is `aria-disabled`, not `disabled`: it stays reachable with the
 * keyboard and the explanation is read with it. It has no handler, so a click
 * does nothing.
 */
export function BookingCard({
  minPriceCentsPerHour,
}: {
  /** Lowest price among the courts (base or rule); `null` if there is none. */
  minPriceCentsPerHour: number | null;
}) {
  return (
    <aside
      aria-label="Reserva"
      data-booking-bar=""
      className="h-(--booking-bar-h) lg:h-auto sticky bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-bg px-4 py-2 shadow-1 md:-mx-10 md:bottom-0 md:px-10 lg:col-start-2 lg:row-start-1 lg:top-28 lg:bottom-auto lg:mx-0 lg:self-start lg:rounded-card lg:border lg:p-6 lg:shadow-3"
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
          <p id={NOTICE_ID} className="text-xs text-muted lg:text-sm">
            Reserva online chega em breve.
          </p>
        </div>
        <Button
          size="sm"
          aria-disabled="true"
          aria-describedby={NOTICE_ID}
          className="shrink-0 cursor-not-allowed opacity-60 hover:bg-brand! lg:h-12 lg:w-full lg:px-5 lg:text-base"
        >
          Escolher horário
        </Button>
      </div>
    </aside>
  );
}
