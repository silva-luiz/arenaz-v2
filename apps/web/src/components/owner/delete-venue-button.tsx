'use client';

import { Alert, Button } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';

export function DeleteVenueButton({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);

  async function remove() {
    setError(undefined);
    setBusy(true);
    const result = await apiSend('DELETE', `/owner/venues/${venueId}`);
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    // Stays busy: the page is about to go away.
    router.replace('/painel');
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
        Excluir espaço
      </Button>
      {confirming ? (
        <div id={panelId} className="flex flex-col gap-3">
          <p className="text-sm">
            Excluir o espaço apaga também quadras, preços, bloqueios e fotos.
            Esta ação não pode ser desfeita.
          </p>
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
