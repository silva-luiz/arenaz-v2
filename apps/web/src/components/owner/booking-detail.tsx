'use client';

import { formatCents, type AgendaItem } from '@arenaz/contracts';
import { Alert, Button } from '@arenaz/ui';
import { useId, useRef, useState } from 'react';
import { bookingStatusLabel } from '@/lib/agenda-layout';
import { apiSend } from '@/lib/api-client';
import { formatPhoneBr } from '@/lib/format-br';
import { formatZonedDay, formatZonedRange } from '@/lib/zoned-time';

export interface BookingDetailProps {
  item: AgendaItem;
  fieldName: string;
  timezone: string;
  /** Called after the booking was cancelled or the block removed. */
  onDone: (message: string) => void;
}

function Row({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted sm:w-28 sm:shrink-0">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * Content of the detail dialog of one agenda item: who, when, how much, where
 * it came from, and the two-step "cancel booking" / "remove block". The API
 * decides whether a booking can still be cancelled; its refusal is shown as
 * it is.
 */
export function BookingDetail({
  item,
  fieldName,
  timezone,
  onDone,
}: BookingDetailProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = `${useId()}-confirmar`;

  const isBooking = item.kind === 'booking';
  const noun = isBooking ? 'reserva' : 'bloqueio';

  async function confirm() {
    setError(undefined);
    setBusy(true);
    const result = isBooking
      ? await apiSend('POST', `/owner/bookings/${item.id}/cancel`)
      : await apiSend('DELETE', `/owner/blocks/${item.id}`);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone(isBooking ? 'Reserva cancelada' : 'Bloqueio removido');
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col gap-3">
        {item.kind === 'booking' ? (
          <>
            <Row label="Cliente">{item.customerName}</Row>
            {item.customerPhone ? (
              <Row label="Telefone">{formatPhoneBr(item.customerPhone)}</Row>
            ) : null}
          </>
        ) : (
          <Row label="Motivo">{item.reason ?? 'Sem motivo informado'}</Row>
        )}
        <Row label="Quadra">{fieldName}</Row>
        <Row label="Dia">{formatZonedDay(item.startsAt, timezone)}</Row>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
          <dt className="text-sm text-muted sm:w-28 sm:shrink-0">Horário</dt>
          <dd className="font-mono font-medium">
            {formatZonedRange(item.startsAt, item.endsAt, timezone)}
          </dd>
        </div>
        {item.kind === 'booking' ? (
          <>
            <Row label="Total">{formatCents(item.totalCents)}</Row>
            <Row label="Origem">
              {item.origin === 'app' ? 'Pelo app' : 'Manual'}
            </Row>
            <Row label="Situação">
              {bookingStatusLabel(item.status).replace(/^./, (letter) =>
                letter.toUpperCase(),
              )}
            </Row>
          </>
        ) : null}
      </dl>

      <Alert tone="error">{error}</Alert>

      <div className="flex flex-col gap-3">
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
          {isBooking ? 'Cancelar reserva' : 'Remover bloqueio'}
        </Button>
        {confirming ? (
          <div id={panelId} className="flex flex-col gap-3">
            <p className="text-sm">
              {isBooking
                ? 'O horário volta a ficar livre. Só dá para cancelar reservas que ainda não começaram.'
                : 'O horário volta a ficar livre para reservas.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                loading={busy}
                onClick={() => {
                  void confirm();
                }}
              >
                {isBooking ? 'Sim, cancelar' : 'Sim, remover'}
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
                {`Manter ${noun}`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
