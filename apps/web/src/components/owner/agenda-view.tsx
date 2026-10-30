'use client';

import type { AgendaItem } from '@arenaz/contracts';
import { Button, cn } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isDemoMode } from '@/lib/demo';
import { AgendaBlockForm } from './agenda-block-form';
import { AgendaDialog } from './agenda-dialog';
import {
  AgendaGrid,
  AgendaList,
  legendEntries,
  type AgendaField,
} from './agenda-grid';
import { BookingDetail } from './booking-detail';
import { ManualBookingForm } from './manual-booking-form';

type OpenDialog = { kind: 'manual' } | { kind: 'block' };

interface Selection {
  item: AgendaItem;
  fieldName: string;
}

export interface AgendaViewProps {
  /** Day shown, "YYYY-MM-DD" in the venue's zone. */
  date: string;
  /** Today in the venue's zone. */
  today: string;
  timezone: string;
  fields: AgendaField[];
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
  /** Left of the actions: the date line and the page's h1. */
  intro?: ReactNode;
  /** Between the actions and the agenda: the owner's numbers. */
  indicators?: ReactNode;
  /** Beside the "Agenda" title: the day navigation. */
  dayNav?: ReactNode;
}

const ACTION = 'min-h-11';

/**
 * The owner's day as in Painel.dc.html: intro with the actions ("Bloquear
 * horário", "+ Reserva manual"), the indicators, the agenda card (title, day
 * navigation, legend, the court × hour table or a list per court on a phone)
 * and, under it, the selected item. After any change the server data is
 * refreshed and the result is announced in a status region.
 */
export function AgendaView({
  date,
  today,
  timezone,
  fields,
  hours,
  intro,
  indicators,
  dayNav,
}: AgendaViewProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [notice, setNotice] = useState('');
  const region = useRef<HTMLElement>(null);
  const detail = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const changed = useRef(false);

  const activeFields = fields.filter((field) => field.isActive);
  const canCreate = activeFields.length > 0;
  const selectedId = selected?.item.id;

  // A new selection takes the focus to its detail (under the agenda; on a
  // phone it is far below the item).
  useEffect(() => {
    if (selectedId) detail.current?.focus();
  }, [selectedId]);

  function open(next: OpenDialog) {
    changed.current = false;
    setNotice('');
    setDialog(next);
  }

  function refreshWith(message: string) {
    setBusy(false);
    setNotice(message);
    router.refresh();
  }

  /** A dialog saved something. */
  function done(message: string) {
    changed.current = true;
    setDialog(null);
    refreshWith(message);
  }

  /** The selected item was cancelled or removed: it leaves the page. */
  function detailDone(message: string) {
    setSelected(null);
    refreshWith(message);
    region.current?.focus();
  }

  function close() {
    setDialog(null);
  }

  function select(
    item: AgendaItem,
    field: AgendaField,
    button: HTMLButtonElement,
  ) {
    // A pending cancel keeps its item on screen until it settles.
    if (busy) return;
    if (selectedId === item.id) {
      setSelected(null);
      return;
    }
    opener.current = button;
    setNotice('');
    setSelected({ item, fieldName: field.name });
  }

  function closeDetail() {
    setSelected(null);
    if (opener.current?.isConnected) opener.current.focus();
    else region.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>{intro}</div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={!canCreate}
            onClick={() => {
              open({ kind: 'block' });
            }}
          >
            Bloquear horário
          </Button>
          <Button
            size="sm"
            className={ACTION}
            disabled={!canCreate}
            onClick={() => {
              open({ kind: 'manual' });
            }}
          >
            + Reserva manual
          </Button>
        </div>
      </div>

      {indicators}

      <section
        id="agenda"
        ref={region}
        tabIndex={-1}
        aria-labelledby="agenda-titulo"
        className="scroll-mt-4 rounded-card border border-line bg-bg px-4 pt-5 pb-[22px] shadow-2 outline-none min-[761px]:px-[22px]"
      >
        <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
          <h2 id="agenda-titulo" className="text-[19px] font-[650]">
            Agenda
          </h2>
          <ul
            aria-label="Legenda"
            className="flex flex-wrap gap-x-3.5 gap-y-2 text-xs text-muted"
          >
            {legendEntries(isDemoMode).map((entry) => (
              <li key={entry.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn('size-2.5 rounded-[3px] border', entry.classes)}
                />
                {entry.label}
              </li>
            ))}
          </ul>
          {/* Its own row: a week of days and any date are more than the
              prototype's three tabs. */}
          {dayNav ? <div className="min-w-0 basis-full">{dayNav}</div> : null}
        </div>

        {/* Out of the flow while empty; announced when a change lands. */}
        <p
          role="status"
          className="mb-3 text-sm font-medium text-brand empty:sr-only"
        >
          {notice}
        </p>

        {fields.length === 0 ? (
          <p className="rounded-[20px] border border-line p-6 text-muted">
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
                onOpen={select}
                selectedId={selectedId}
              />
            </div>
            <div data-agenda="list" className="md:hidden">
              <AgendaList
                timezone={timezone}
                fields={fields}
                onOpen={select}
                selectedId={selectedId}
              />
            </div>
          </>
        )}
      </section>

      {selected ? (
        <BookingDetail
          key={selected.item.id}
          ref={detail}
          item={selected.item}
          fieldName={selected.fieldName}
          timezone={timezone}
          onDone={detailDone}
          onClose={closeDetail}
          onBusyChange={setBusy}
        />
      ) : null}

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
    </div>
  );
}
