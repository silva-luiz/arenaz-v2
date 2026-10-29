'use client';

import type { AgendaItem } from '@arenaz/contracts';
import { Button, cn } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AgendaBlockForm } from './agenda-block-form';
import { AgendaDialog } from './agenda-dialog';
import {
  AgendaGrid,
  AgendaList,
  LEGEND_ITEMS,
  type AgendaField,
} from './agenda-grid';
import { BookingDetail } from './booking-detail';
import { ManualBookingForm } from './manual-booking-form';

type OpenDialog =
  | { kind: 'manual' }
  | { kind: 'block' }
  | { kind: 'detail'; item: AgendaItem; fieldName: string };

export interface AgendaViewProps {
  /** Day shown, "YYYY-MM-DD" in the venue's zone. */
  date: string;
  /** Today in the venue's zone. */
  today: string;
  timezone: string;
  fields: AgendaField[];
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
}

/**
 * The owner's agenda of one day: actions, legend, the court × time table (a
 * list per court on a phone) and the dialogs. After any change the server
 * data is refreshed and the result is announced in a status region.
 */
export function AgendaView({
  date,
  today,
  timezone,
  fields,
  hours,
}: AgendaViewProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [notice, setNotice] = useState('');
  const region = useRef<HTMLDivElement>(null);
  const changed = useRef(false);

  const activeFields = fields.filter((field) => field.isActive);
  const canCreate = activeFields.length > 0;

  function open(next: OpenDialog) {
    changed.current = false;
    setNotice('');
    setDialog(next);
  }

  function done(message: string) {
    changed.current = true;
    setBusy(false);
    setDialog(null);
    setNotice(message);
    router.refresh();
  }

  function close() {
    setDialog(null);
  }

  function openItem(item: AgendaItem, field: AgendaField) {
    open({ kind: 'detail', item, fieldName: field.name });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul
          aria-label="Legenda"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"
        >
          {LEGEND_ITEMS.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('size-3 rounded-[3px] border', entry.classes)}
              />
              {entry.label}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={!canCreate}
            onClick={() => {
              open({ kind: 'block' });
            }}
          >
            Bloquear horário
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => {
              open({ kind: 'manual' });
            }}
          >
            + Reserva manual
          </Button>
        </div>
      </div>

      <p role="status" className="min-h-5 text-sm font-medium text-brand">
        {notice}
      </p>

      <div ref={region} tabIndex={-1} className="outline-none">
        {fields.length === 0 ? (
          <p className="rounded-card border border-line p-6 text-muted">
            Cadastre uma quadra para ver a agenda.
          </p>
        ) : (
          <>
            {/* Chosen by CSS, so the first paint is already the right one. */}
            <div data-agenda="grid" className="hidden md:block">
              <AgendaGrid
                date={date}
                timezone={timezone}
                fields={fields}
                hours={hours}
                onOpen={openItem}
              />
            </div>
            <div data-agenda="list" className="md:hidden">
              <AgendaList
                timezone={timezone}
                fields={fields}
                onOpen={openItem}
              />
            </div>
          </>
        )}
      </div>

      {dialog?.kind === 'manual' ? (
        <AgendaDialog
          title="Reserva manual"
          onClose={close}
          fallbackFocusRef={region}
          locked={busy}
          wasChanged={() => changed.current}
        >
          <ManualBookingForm
            fields={activeFields}
            timezone={timezone}
            date={date}
            today={today}
            onDone={done}
            onBusyChange={setBusy}
          />
        </AgendaDialog>
      ) : null}
      {dialog?.kind === 'block' ? (
        <AgendaDialog
          title="Bloquear horário"
          onClose={close}
          fallbackFocusRef={region}
          locked={busy}
          wasChanged={() => changed.current}
        >
          <AgendaBlockForm
            fields={activeFields}
            timezone={timezone}
            date={date}
            today={today}
            onDone={done}
            onBusyChange={setBusy}
          />
        </AgendaDialog>
      ) : null}
      {dialog?.kind === 'detail' ? (
        <AgendaDialog
          title={dialog.item.kind === 'booking' ? 'Reserva' : 'Bloqueio'}
          onClose={close}
          fallbackFocusRef={region}
          locked={busy}
          wasChanged={() => changed.current}
        >
          <BookingDetail
            item={dialog.item}
            fieldName={dialog.fieldName}
            timezone={timezone}
            onDone={done}
            onBusyChange={setBusy}
          />
        </AgendaDialog>
      ) : null}
    </div>
  );
}
