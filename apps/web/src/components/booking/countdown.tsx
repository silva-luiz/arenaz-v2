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

export interface CountdownProps {
  /** The server's deadline (ISO with offset). */
  expiresAt: string;
  /**
   * The server's clock when the page was rendered. The browser clock is
   * shifted by the difference, so a device that runs fast or slow does not
   * expire the hold early or late.
   */
  serverNow?: string | undefined;
  /** Called once, when the deadline is reached. */
  onExpire?: (() => void) | undefined;
}

/**
 * Time left to pay, against the server's deadline (never a client-side
 * 10-minute guess). The digits tick every second but are hidden from screen
 * readers; a polite status region speaks only when the minute changes and at
 * the end. No animation, so nothing to reduce for `prefers-reduced-motion`.
 */
export function Countdown({ expiresAt, serverNow, onExpire }: CountdownProps) {
  const deadline = new Date(expiresAt).getTime();
  // Fixed when the component mounts (the parent re-keys it on a new render).
  const [skew] = useState(() =>
    serverNow === undefined ? 0 : new Date(serverNow).getTime() - Date.now(),
  );
  // Whole seconds left: the snapshot only changes once a second. The server
  // renders nothing (null), so the clocks of server and browser never clash.
  const seconds = useSyncExternalStore(
    subscribe,
    () => Math.max(0, Math.ceil((deadline - (Date.now() + skew)) / 1000)),
    () => null,
  );
  const expired = seconds === 0;

  const notified = useRef(false);
  useEffect(() => {
    if (expired && !notified.current) {
      notified.current = true;
      onExpire?.();
    }
  }, [expired, onExpire]);

  if (seconds === null) return <div className="min-h-12" />;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;

  return (
    <div className="min-h-12">
      {expired ? null : (
        <p className="text-sm text-muted" aria-hidden="true">
          Pague em{' '}
          <span className="font-mono text-2xl font-semibold text-ink">
            {clock}
          </span>
        </p>
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
