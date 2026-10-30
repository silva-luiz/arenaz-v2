'use client';

import { Alert, Button } from '@arenaz/ui';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';

export interface DeleteButtonProps<T extends string> {
  /** Text of the button that opens the confirmation, e.g. "Excluir quadra". */
  label: string;
  /** What goes away with it; shown in the confirmation. */
  warning: string;
  /** API path to DELETE, without the `/api` prefix. */
  path: string;
  /** Where to go once it is gone. */
  redirectTo: Route<T>;
}

/** Two-step delete: the first click only asks, the second one deletes. */
export function DeleteButton<T extends string>({
  label,
  warning,
  path,
  redirectTo,
}: DeleteButtonProps<T>) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);

  async function remove() {
    setError(undefined);
    setBusy(true);
    const result = await apiSend('DELETE', path);
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    // Stays busy: the page is about to go away.
    router.replace(redirectTo);
    // The panel layout (sidebar venue and court count) is not re-rendered by
    // a navigation; refresh it too.
    router.refresh();
  }

  const panelId = `${useId()}-confirmar`;

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="error">{error}</Alert>
      <Button
        ref={trigger}
        variant="danger"
        className="self-start"
        aria-expanded={confirming}
        aria-controls={confirming ? panelId : undefined}
        onClick={() => {
          setConfirming((open) => !open);
          setError(undefined);
        }}
      >
        {label}
      </Button>
      {confirming ? (
        <div id={panelId} className="flex flex-col gap-3">
          <p className="text-sm">{warning}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                void remove();
              }}
            >
              Confirmar exclusão
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              autoFocus
              onClick={() => {
                setConfirming(false);
                setError(undefined);
                trigger.current?.focus();
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
