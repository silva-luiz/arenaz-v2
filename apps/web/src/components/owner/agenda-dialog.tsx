'use client';

import { Button } from '@arenaz/ui';
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

export interface AgendaDialogProps {
  title: string;
  onClose: () => void;
  /** Receives the focus when the opener is gone (a cancelled booking). */
  fallbackFocusRef: RefObject<HTMLElement | null>;
  /**
   * Returns `true` when the dialog closes because something changed: the page
   * behind is about to be re-rendered, so the opener may be replaced and the
   * focus goes to `fallbackFocusRef` instead.
   */
  wasChanged: () => boolean;
  children: ReactNode;
}

/**
 * Modal on the native `<dialog>` (`showModal()`: top layer, inert page behind,
 * focus trap). Mount it to open, unmount it to close. The focus goes to
 * "Fechar" on open and back to whatever opened it on close; if that element
 * left the page meanwhile, to `fallbackFocusRef`.
 */
export function AgendaDialog({
  title,
  onClose,
  fallbackFocusRef,
  wasChanged,
  children,
}: AgendaDialogProps) {
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
    const opener = openerRef.current;
    const fallback = fallbackFocusRef.current;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // The unmount happens before the next paint, but the page behind may
      // still be re-rendering; wait for the commit.
      queueMicrotask(() => {
        if (!wasChanged() && opener?.isConnected) opener.focus();
        else fallback?.focus();
      });
    };
    // Mount/unmount only: the focus target is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[92dvh] w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-card bg-bg p-0 text-ink shadow-3 backdrop:bg-night/60 open:flex open:flex-col"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <h2 id={titleId} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        <Button ref={closeRef} variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        {children}
      </div>
    </dialog>
  );
}
