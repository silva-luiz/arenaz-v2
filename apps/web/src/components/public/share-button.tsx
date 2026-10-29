'use client';

import { FOCUS_RING, cn } from '@arenaz/ui';
import { useEffect, useRef, useState } from 'react';

const COPIED_MESSAGE = 'Link copiado';
const MESSAGE_MS = 4000;

/** This page without query or hash: the link worth sharing. */
function pageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

/**
 * "Compartilhar": the system share sheet when the browser has one; otherwise
 * the link is copied and "Link copiado" is announced in a polite live region;
 * and when even that is not possible (no clipboard access, an insecure
 * context) the link is shown in a field to copy by hand. Dismissing the share
 * sheet is not an error and falls back to nothing.
 */
export function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState('');
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (manualUrl !== null) inputRef.current?.select();
  }, [manualUrl]);

  function announce(text: string) {
    clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => {
      setMessage('');
    }, MESSAGE_MS);
  }

  async function share() {
    const url = pageUrl();
    // The DOM typings say these always exist; browsers differ.
    const nav: Partial<Navigator> = navigator;
    setManualUrl(null);

    if (typeof nav.share === 'function') {
      try {
        await nav.share({ title, url });
        return;
      } catch (error) {
        if (isAbort(error)) return;
        // The share sheet failed for another reason: copy instead.
      }
    }

    if (typeof nav.clipboard?.writeText === 'function') {
      try {
        await nav.clipboard.writeText(url);
        announce(COPIED_MESSAGE);
        return;
      } catch {
        // Clipboard access refused: show the link instead.
      }
    }

    setManualUrl(url);
  }

  return (
    <div className="relative md:-mr-3">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          void share();
        }}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-button px-3 text-sm font-semibold underline underline-offset-4 transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
          FOCUS_RING,
        )}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Compartilhar
      </button>
      <p
        role="status"
        aria-live="polite"
        className="absolute top-full right-0 mt-1 text-sm font-semibold whitespace-nowrap text-brand"
      >
        {message}
      </p>
      {manualUrl === null ? null : (
        <div className="absolute top-full right-0 z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-photo border border-line bg-bg p-3 shadow-3">
          <label className="block text-xs font-semibold" htmlFor="link-espaco">
            Link do espaço
          </label>
          <input
            ref={inputRef}
            id="link-espaco"
            type="text"
            readOnly
            value={manualUrl}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setManualUrl(null);
                buttonRef.current?.focus();
              }
            }}
            className="mt-1 h-11 w-full rounded-button border border-line-control bg-bg px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <p className="mt-1 text-xs text-muted">
            Copie o link e envie para quem quiser.
          </p>
        </div>
      )}
    </div>
  );
}
