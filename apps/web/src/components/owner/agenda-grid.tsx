'use client';

import type { AgendaItem, OwnerAgenda } from '@arenaz/contracts';
import { cn } from '@arenaz/ui';
import { useEffect, useRef } from 'react';
import {
  agendaRowMinutes,
  buildAgendaGrid,
  hourGroups,
  itemAriaLabel,
  placeItem,
} from '@/lib/agenda-layout';
import { formatZonedRange, todayInZone } from '@/lib/zoned-time';

export type AgendaField = OwnerAgenda['fields'][number];

export interface AgendaItemHandler {
  (item: AgendaItem, field: AgendaField, opener: HTMLButtonElement): void;
}

/** Width of the court column and of each 30-minute column (Painel.dc.html). */
const COURT_COLUMN_PX = 170;
const SLOT_COLUMN_PX = 56;

// Colors of the prototype (Painel.dc.html `kinds`). Blocks are hatched; a hold
// has a dashed outline; each item also says what it is in its name and the
// detail, so color is never the only cue.
const APP_CLASSES = 'border-[#8CC9A6] bg-[#DDF0E5] text-[#0B4A2E]';
const MANUAL_CLASSES = 'border-[#C4C4C4] bg-[#F2F2F2] text-[#333333]';
const MONTHLY_CLASSES = 'border-[#9DB0EC] bg-[#E3E9FB] text-[#1E3478]';
const OPEN_GAME_CLASSES = 'border-[#E9B566] bg-[#FFF1DD] text-[#6B4300]';
const BLOCK_CLASSES =
  'border-[#8A8A8A] bg-[repeating-linear-gradient(45deg,#f2f2f2_0,#f2f2f2_6px,#dcdcdc_6px,#dcdcdc_12px)] text-[#333333]';

function itemClasses(item: AgendaItem): string {
  if (item.kind === 'block') return BLOCK_CLASSES;
  const base = item.origin === 'app' ? APP_CLASSES : MANUAL_CLASSES;
  // A hold that has not been paid yet: dashed outline.
  return item.status === 'held' ? `${base} border-dashed` : base;
}

// A shape beside the time, so app, manual and unpaid items differ without
// color too: phone (app), pencil (typed by the owner), clock (awaiting payment).
const ORIGIN_ICONS = {
  app: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  manual: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  held: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
} as const;

function OriginIcon({ item }: { item: AgendaItem }) {
  if (item.kind === 'block') return null;
  const path =
    item.status === 'held' ? ORIGIN_ICONS.held : ORIGIN_ICONS[item.origin];
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

function itemTitle(item: AgendaItem): string {
  return item.kind === 'block' ? 'Bloqueio' : item.customerName;
}

function itemTag(item: AgendaItem): string {
  if (item.kind === 'block') return item.reason ?? 'Sem motivo';
  if (item.status === 'held') return 'Aguardando pagamento';
  return item.origin === 'app' ? 'Pelo app' : 'Manual';
}

export interface LegendEntry {
  label: string;
  classes: string;
}

/**
 * Swatches of the legend, with the same classes as the items. "Mensalista"
 * and "Partida aberta" are types of the prototype that do not exist yet: they
 * appear only in the demo and never have items.
 */
export function legendEntries(demo: boolean): LegendEntry[] {
  return [
    { label: 'Pelo app', classes: APP_CLASSES },
    ...(demo ? [{ label: 'Mensalista', classes: MONTHLY_CLASSES }] : []),
    { label: 'Manual', classes: MANUAL_CLASSES },
    ...(demo ? [{ label: 'Partida aberta', classes: OPEN_GAME_CLASSES }] : []),
    { label: 'Bloqueio', classes: BLOCK_CLASSES },
    { label: 'Aguardando pagamento', classes: `${APP_CLASSES} border-dashed` },
  ];
}

interface ItemButtonProps {
  item: AgendaItem;
  field: AgendaField;
  timezone: string;
  onOpen: AgendaItemHandler;
  selected: boolean;
  /** `cell` fills its table cell; `row` is a block of a list. */
  layout: 'cell' | 'row';
}

function ItemButton({
  item,
  field,
  timezone,
  onOpen,
  selected,
  layout,
}: ItemButtonProps) {
  return (
    <button
      type="button"
      aria-label={itemAriaLabel(item, field.name, timezone)}
      aria-pressed={selected}
      onClick={(event) => {
        onOpen(item, field, event.currentTarget);
      }}
      className={cn(
        'flex min-w-0 flex-col items-start justify-center overflow-hidden rounded-[10px] border px-2.5 py-1.5 text-left transition-[transform,box-shadow,filter] duration-150 hover:brightness-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none',
        layout === 'cell'
          ? 'absolute inset-x-[3px] inset-y-1.5'
          : 'min-h-14 w-full',
        selected
          ? 'shadow-[0_0_0_2px_#161616,0_12px_24px_-10px_rgba(0,0,0,0.45)] -translate-y-0.5 motion-reduce:translate-y-0'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
        itemClasses(item),
      )}
    >
      {/* The glyph rides on the name line: the time range below keeps the
          whole width, so a one-hour item shows "19:00–20:00" in full. */}
      <span className="flex w-full min-w-0 items-center gap-1">
        <strong className="min-w-0 truncate text-[13px] font-[650]">
          {itemTitle(item)}
        </strong>
        <OriginIcon item={item} />
      </span>
      <span className="block w-full truncate text-xs tabular-nums opacity-80">
        {formatZonedRange(item.startsAt, item.endsAt, timezone)}
        {/* The list has room for the origin or the reason in words. */}
        {layout === 'row' ? ` · ${itemTag(item)}` : null}
      </span>
    </button>
  );
}

/** A court in the agenda: a pitch glyph in place of a court photo. */
function CourtTile() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18v12H3zM12 6v12M12 9.5a2.5 2.5 0 1 1 0 5" />
      </svg>
    </span>
  );
}

function CourtName({ field }: { field: AgendaField }) {
  return (
    <span className="min-w-0">
      <span className="block truncate">{field.name}</span>
      {field.isActive ? null : (
        <span className="block text-xs font-normal text-muted">Inativa</span>
      )}
    </span>
  );
}

const minuteFormats = new Map<string, Intl.DateTimeFormat>();

/** Minute of the day now on the clocks of `timeZone`. */
function minuteNow(timeZone: string): number {
  let format = minuteFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    minuteFormats.set(timeZone, format);
  }
  const parts = Object.fromEntries(
    format.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export interface AgendaGridProps {
  date: string;
  timezone: string;
  fields: AgendaField[];
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
  onOpen: AgendaItemHandler;
  /** Id of the selected item (pressed). */
  selectedId?: string | undefined;
}

/**
 * Court × hour table of Painel.dc.html: a row per court, a column per 30
 * minutes of the opening hours (an hour header over each pair). Items span
 * the columns they cover and are toggle buttons that select them. Real
 * `<table>` with row and column headers; it scrolls sideways inside its card
 * with the courts fixed, and opens on the current hour (today) or the first
 * item.
 */
export function AgendaGrid({
  date,
  timezone,
  fields,
  hours,
  onOpen,
  selectedId,
}: AgendaGridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const placed = fields.flatMap((field) =>
    field.items.map((item) => placeItem(item, date, timezone)),
  );
  const columns = agendaRowMinutes(hours, date, placed);
  const firstItemMinute = placed.length
    ? Math.min(...placed.map((entry) => entry.startMinute))
    : undefined;

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const target =
      date === todayInZone(timezone)
        ? minuteNow(timezone) - 60
        : firstItemMinute;
    if (target === undefined) return;
    const headers = [
      ...box.querySelectorAll<HTMLElement>('th[data-minute]'),
    ].filter((header) => Number(header.dataset.minute) <= target);
    const header = headers.at(-1);
    if (header) box.scrollLeft = header.offsetLeft - COURT_COLUMN_PX;
    // Once per day shown (the view remounts per day).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (columns.length === 0) {
    return (
      <p className="rounded-card border border-line p-6 text-muted">
        O espaço não abre neste dia e não há reservas.
      </p>
    );
  }

  const { cells: grid, overflow } = buildAgendaGrid(
    fields,
    columns,
    date,
    timezone,
  );
  const groups = hourGroups(columns);

  return (
    <div className="flex flex-col gap-4">
      {/* Scrolls sideways: reachable by keyboard even on a day with no items. */}
      <div
        ref={scroller}
        role="group"
        aria-label="Grade da agenda"
        tabIndex={0}
        className="overflow-x-auto rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <table
          className="w-full table-fixed border-collapse"
          style={{
            minWidth: `${String(COURT_COLUMN_PX + columns.length * SLOT_COLUMN_PX)}px`,
          }}
        >
          <caption className="sr-only">
            Agenda do dia, quadras por horário
          </caption>
          <colgroup>
            <col style={{ width: `${String(COURT_COLUMN_PX)}px` }} />
            {columns.map((minute) => (
              <col key={minute} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-bg pb-2 text-left"
              >
                <span className="sr-only">Quadra</span>
              </th>
              {groups.map((group) => (
                <th
                  key={group.minute}
                  scope="col"
                  colSpan={group.span}
                  data-minute={group.minute}
                  className="border-l border-line pb-2 pl-1.5 text-left font-mono text-xs font-medium text-muted"
                >
                  {group.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, row) => (
              <tr key={field.id} className="h-16 border-t border-line">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-bg pr-2 text-left text-sm font-semibold"
                >
                  <span className="flex items-center gap-2.5">
                    <CourtTile />
                    <CourtName field={field} />
                  </span>
                </th>
                {columns.map((minute, column) => {
                  const cell = grid[column]?.[row];
                  if (cell?.kind === 'covered') return null;
                  if (cell?.kind === 'item') {
                    return (
                      <td
                        key={minute}
                        colSpan={cell.span}
                        className="relative p-0"
                      >
                        <ItemButton
                          item={cell.placed.item}
                          field={field}
                          timezone={timezone}
                          onOpen={onOpen}
                          selected={cell.placed.item.id === selectedId}
                          layout="cell"
                        />
                      </td>
                    );
                  }
                  return <td key={minute} className="p-0" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fields.map((field, column) => {
        const extra = overflow[column] ?? [];
        if (extra.length === 0) return null;
        return (
          <section
            key={field.id}
            aria-labelledby={`agenda-outros-${field.id}`}
            className="rounded-[20px] border border-line p-4"
          >
            <h2
              id={`agenda-outros-${field.id}`}
              className="mb-1 text-base font-semibold"
            >
              {`Outros horários nesta quadra: ${field.name}`}
            </h2>
            <p className="mb-3 text-sm text-muted">
              Estes horários se sobrepõem a outros ou não começam em hora cheia
              ou meia hora, por isso não cabem na grade.
            </p>
            <ul className="flex flex-col gap-2">
              {extra.map(({ item }) => (
                <li key={item.id}>
                  <ItemButton
                    item={item}
                    field={field}
                    timezone={timezone}
                    onOpen={onOpen}
                    selected={item.id === selectedId}
                    layout="row"
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export interface AgendaListProps {
  timezone: string;
  fields: AgendaField[];
  onOpen: AgendaItemHandler;
  selectedId?: string | undefined;
}

function byStart(a: AgendaItem, b: AgendaItem): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

/** Phone layout: one list per court, sorted by start. */
export function AgendaList({
  timezone,
  fields,
  onOpen,
  selectedId,
}: AgendaListProps) {
  return (
    <div className="flex flex-col">
      {fields.map((field) => {
        const items = [...field.items].sort(byStart);
        return (
          <section
            key={field.id}
            aria-labelledby={`agenda-quadra-${field.id}`}
            className="border-t border-line py-4 last:pb-0"
          >
            <h2
              id={`agenda-quadra-${field.id}`}
              className="mb-3 flex items-center gap-2.5 text-sm font-semibold"
            >
              <CourtTile />
              <CourtName field={field} />
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma reserva ou bloqueio neste dia.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <ItemButton
                      item={item}
                      field={field}
                      timezone={timezone}
                      onOpen={onOpen}
                      selected={item.id === selectedId}
                      layout="row"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
