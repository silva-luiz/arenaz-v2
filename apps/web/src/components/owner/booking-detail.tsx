'use client';

import { formatCents, type AgendaItem } from '@arenaz/contracts';
import { Alert, Button, cn } from '@arenaz/ui';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { apiSend } from '@/lib/api-client';
import { isDemoMode } from '@/lib/demo';
import { formatPhoneBr } from '@/lib/format-br';
import { formatZonedRange } from '@/lib/zoned-time';

export interface BookingDetailProps {
  item: AgendaItem;
  fieldName: string;
  timezone: string;
  /** Called after the booking was cancelled or the block removed. */
  onDone: (message: string) => void;
  /** Esc: the owner leaves the detail (ignored while a request is pending). */
  onClose: () => void;
  /** Told when a request starts and ends (the selection is kept meanwhile). */
  onBusyChange?: (busy: boolean) => void;
  /** The panel itself, focused when an item is selected. */
  ref?: Ref<HTMLElement>;
}

const ACTION = 'min-h-11';

/** "Pelo app · R$ 360,00", "Reserva manual · R$ 180,00 · (11) …", the reason. */
function detailLine(item: AgendaItem): string {
  if (item.kind === 'block') return item.reason ?? 'Sem motivo informado';
  const parts = [
    item.origin === 'app' ? 'Pelo app' : 'Reserva manual',
    formatCents(item.totalCents),
  ];
  if (item.customerPhone) parts.push(formatPhoneBr(item.customerPhone));
  return parts.join(' · ');
}

/** The pill of Painel.dc.html: how the booking stands. */
function statusPill(item: AgendaItem): { label: string; classes: string } {
  if (item.kind === 'block') {
    return {
      label: 'Horário bloqueado',
      classes: 'bg-[#F2F2F2] text-[#333333]',
    };
  }
  if (item.status === 'held') {
    return {
      label: 'Aguardando pagamento',
      classes: 'bg-[#FFF1DD] text-[#6B4300]',
    };
  }
  return item.origin === 'app'
    ? { label: 'Pago no Pix', classes: 'bg-brand-soft text-brand-deep' }
    : { label: 'Pagar no local', classes: 'bg-[#F2F2F2] text-[#333333]' };
}

/**
 * The selected agenda item, under the agenda (Painel.dc.html): court and
 * time, who, origin and price, a status pill, and the two-step "cancel
 * booking" / "remove block". The API decides whether a booking can still be
 * cancelled; its refusal is shown as it is.
 */
export function BookingDetail({
  item,
  fieldName,
  timezone,
  onDone,
  onClose,
  onBusyChange,
  ref,
}: BookingDetailProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const [error, setError] = useState<string | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);
  const baseId = useId();
  const panelId = `${baseId}-confirmar`;

  const isBooking = item.kind === 'booking';
  const noun = isBooking ? 'reserva' : 'bloqueio';
  // A confirmed app booking was paid through the app: cancelling it does not
  // refund the player by itself (refunds go through support for now).
  const paidInApp =
    item.kind === 'booking' &&
    item.origin === 'app' &&
    item.status === 'confirmed';
  const pill = statusPill(item);

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

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Escape' || busy) return;
    event.preventDefault();
    onClose();
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={isBooking ? 'Reserva selecionada' : 'Bloqueio selecionado'}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-5 rounded-card border border-line bg-bg px-[22px] py-5 shadow-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div className="min-w-0 flex-[1_1_260px]">
        <p className="text-[13px] text-muted">
          {`${fieldName} · ${formatZonedRange(item.startsAt, item.endsAt, timezone)}`}
        </p>
        <h2 className="mt-1 text-lg font-[650]">
          {item.kind === 'block' ? 'Bloqueio' : item.customerName}
        </h2>
        <p className="mt-1 text-sm text-muted">{detailLine(item)}</p>
      </div>
      <span
        className={cn(
          'rounded-full px-3 py-2 text-[13px] font-[650]',
          pill.classes,
        )}
      >
        {pill.label}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          ref={trigger}
          variant="secondary"
          size="sm"
          className={ACTION}
          aria-expanded={confirming}
          aria-controls={confirming ? panelId : undefined}
          onClick={() => {
            setConfirming((open) => !open);
            setError(undefined);
          }}
        >
          {isBooking ? 'Cancelar reserva' : 'Remover bloqueio'}
        </Button>
        {/* Messages are a later plan: only teased in the demo. */}
        {isDemoMode && isBooking ? (
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled
            title="Em breve"
          >
            Mandar mensagem <span className="sr-only">(em breve)</span>
          </Button>
        ) : null}
      </div>

      {/* Out of the flow while empty (no extra gap in the row). */}
      <Alert tone="error" className="basis-full">
        {error}
      </Alert>

      {confirming ? (
        <div id={panelId} className="flex basis-full flex-col gap-3">
          <p className="text-sm">
            {isBooking
              ? 'O horário volta a ficar livre. Só dá para cancelar reservas que ainda não começaram.'
              : 'O horário volta a ficar livre para reservas.'}
          </p>
          {paidInApp ? (
            <p className="text-sm font-medium">
              O jogador já pagou. O reembolso será tratado pelo suporte.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              size="sm"
              className={ACTION}
              loading={busy}
              onClick={() => {
                void confirm();
              }}
            >
              {isBooking ? 'Sim, cancelar' : 'Sim, remover'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={ACTION}
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
    </section>
  );
}
