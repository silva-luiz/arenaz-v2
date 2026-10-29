'use client';

import { cancelBookingResponseSchema } from '@arenaz/contracts';
import { Alert, Button } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';

/**
 * Two-step cancellation of a confirmed booking. The 24 hour rule lives in the
 * API; when it says no (409) its message is shown as it is.
 */
export function CancelBooking({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `${useId()}-confirmar`;

  async function cancel() {
    setError(undefined);
    setBusy(true);
    const result = await apiSend(
      'POST',
      `/bookings/${bookingId}/cancel`,
      undefined,
      cancelBookingResponseSchema,
    );
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    // Stays busy: the page reloads as a cancelled booking.
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="error">{error}</Alert>
      <Button
        ref={trigger}
        variant="secondary"
        className="self-start"
        aria-expanded={confirming}
        aria-controls={confirming ? panelId : undefined}
        onClick={() => {
          setConfirming((open) => !open);
          setError(undefined);
        }}
      >
        Cancelar reserva
      </Button>
      {confirming ? (
        <div id={panelId} className="flex flex-col gap-3">
          <p className="text-sm">
            O cancelamento só é possível com pelo menos 24 horas de
            antecedência. O horário volta a ficar livre para outras pessoas e o
            reembolso é tratado pelo suporte.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                void cancel();
              }}
            >
              Sim, cancelar
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
              Voltar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
