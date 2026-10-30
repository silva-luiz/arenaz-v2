'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export const EXPIRED_TEXT = 'O prazo para pagamento acabou';

const TICK_MS = 250;

function subscribe(notify: () => void): () => void {
  const timer = setInterval(notify, TICK_MS);
  return () => {
    clearInterval(timer);
  };
}

function minutesText(minutes: number): string {
  return minutes === 1
    ? 'Falta 1 minuto para pagar'
    : `Faltam ${String(minutes)} minutos para pagar`;
}

function skewOf(serverNow: string | undefined): number {
  return serverNow === undefined
    ? 0
    : new Date(serverNow).getTime() - Date.now();
}

export interface CountdownProps {
  /** The server's deadline (ISO with offset). */
  expiresAt: string;
  /**
   * The server's clock when the page was rendered. The browser clock is
   * shifted by the difference, so a device that runs fast or slow does not
   * expire the hold early or late.
   */
  serverNow?: string | undefined;
  /** Called once, when the deadline is reached (`live`: seen running out). */
  onExpire?: ((live: boolean) => void) | undefined;
}

/**
 * Time left to pay, against the server's deadline (never a client-side
 * 10-minute guess), as in the prototype's Pix step ("Seu horário está
 * reservado por 09:52"). The digits tick every second but are hidden from screen
 * readers; a polite status region speaks only when the minute changes and at
 * the end. No animation, so nothing to reduce for `prefers-reduced-motion`.
 */
export function Countdown({ expiresAt, serverNow, onExpire }: CountdownProps) {
  const deadline = new Date(expiresAt).getTime();
  // The browser clock's shift from the server's. Fixed when the component
  // mounts and re-based only when the page brings a new `serverNow` (a refresh
  // that still says "held"). Never recomputed from an old `serverNow`, so a
  // re-render cannot undo an expiry. The component stays mounted across those
  // refreshes: its status region is never destroyed and re-inserted, which a
  // screen reader could announce again.
  const [base, setBase] = useState(() => ({
    serverNow,
    skew: skewOf(serverNow),
  }));
  if (base.serverNow !== serverNow) {
    setBase({ serverNow, skew: skewOf(serverNow) });
  }
  const skew = base.skew;
  // Whole seconds left: the snapshot only changes once a second. The server
  // renders nothing (null), so the clocks of server and browser never clash.
  const seconds = useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.ceil((deadline - (Date.now() + skew)) / 1000)),
    () => null,
  );
  const expired = seconds === 0;

  // `live` tells the parent whether the hold ran out while this was mounted.
  // One that is already over when it appears (the page was rendered after the
  // deadline, or the clocks disagree) is reported as not live: the parent shows
  // the expired view but must not refresh, which would remount this and loop.
  const wasLive = useRef(false);
  const notified = useRef(false);
  useEffect(() => {
    if (seconds !== null && seconds > 0) {
      wasLive.current = true;
      // Time left again (a refreshed page re-based the clock): the next
      // expiry is reported anew.
      notified.current = false;
    }
    if (expired && !notified.current) {
      notified.current = true;
      onExpire?.(wasLive.current);
    }
  }, [seconds, expired, onExpire]);

  if (seconds === null) return <div className="min-h-[4.5rem]" />;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;

  return (
    <div className="flex min-h-[4.5rem] flex-col items-center text-center">
      {expired ? null : (
        <div aria-hidden="true">
          <p className="text-[15px] text-muted">
            Seu horário está reservado por
          </p>
          <p className="font-mono text-[34px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink">
            {clock}
          </p>
        </div>
      )}
      <p
        role="status"
        className={expired ? 'font-semibold text-ink' : 'sr-only'}
      >
        {expired ? EXPIRED_TEXT : minutesText(Math.ceil(seconds / 60))}
      </p>
    </div>
  );
}
