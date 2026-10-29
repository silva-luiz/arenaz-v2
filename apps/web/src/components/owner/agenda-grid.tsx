'use client';

import type { AgendaItem, OwnerAgenda } from '@arenaz/contracts';
import { cn } from '@arenaz/ui';
import {
  agendaRowMinutes,
  buildAgendaGrid,
  itemAriaLabel,
  placeItem,
} from '@/lib/agenda-layout';
import { formatMinute } from '@/lib/format-br';
import { formatZonedRange } from '@/lib/zoned-time';

export type AgendaField = OwnerAgenda['fields'][number];

export interface AgendaItemHandler {
  (item: AgendaItem, field: AgendaField): void;
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// Colors of the prototype (Painel.dc.html): app and manual bookings. Blocks are
// hatched; the text says what each one is, so color is never the only cue.
const APP_CLASSES = 'border-[#8CC9A6] bg-[#DDF0E5] text-[#0B4A2E]';
const MANUAL_CLASSES = 'border-[#C4C4C4] bg-[#F2F2F2] text-[#333333]';
const BLOCK_CLASSES =
  'border-[#8A8A8A] bg-[repeating-linear-gradient(45deg,#f2f2f2_0,#f2f2f2_6px,#dcdcdc_6px,#dcdcdc_12px)] text-[#333333]';

function itemClasses(item: AgendaItem): string {
  if (item.kind === 'block') return BLOCK_CLASSES;
  const base = item.origin === 'app' ? APP_CLASSES : MANUAL_CLASSES;
  // A hold that has not been paid yet: dashed outline.
  return item.status === 'held' ? `${base} border-dashed` : base;
}

function itemTitle(item: AgendaItem): string {
  return item.kind === 'block' ? 'Bloqueio' : item.customerName;
}

function itemTag(item: AgendaItem): string {
  if (item.kind === 'block') return item.reason ?? 'Sem motivo';
  if (item.status === 'held') return 'Aguardando pagamento';
  return item.origin === 'app' ? 'Pelo app' : 'Manual';
}

/** Swatches of the legend; the same classes as the items. */
export const LEGEND_ITEMS = [
  { label: 'Pelo app', classes: APP_CLASSES },
  { label: 'Manual', classes: MANUAL_CLASSES },
  { label: 'Bloqueio', classes: BLOCK_CLASSES },
  { label: 'Aguardando pagamento', classes: `${APP_CLASSES} border-dashed` },
] as const;

interface ItemButtonProps {
  item: AgendaItem;
  field: AgendaField;
  timezone: string;
  onOpen: AgendaItemHandler;
  /** `cell` fills its table cell; `row` is a block of the phone list. */
  layout: 'cell' | 'row';
}

function ItemButton({
  item,
  field,
  timezone,
  onOpen,
  layout,
}: ItemButtonProps) {
  return (
    <button
      type="button"
      aria-label={itemAriaLabel(item, field.name, timezone)}
      onClick={() => {
        onOpen(item, field);
      }}
      className={cn(
        'flex flex-col items-start justify-center overflow-hidden rounded-[10px] border px-2 py-1 text-left text-xs leading-tight',
        layout === 'cell'
          ? 'absolute inset-0.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand'
          : cn('min-h-14 w-full', FOCUS),
        itemClasses(item),
      )}
    >
      <span className="w-full truncate text-sm font-semibold">
        {itemTitle(item)}
      </span>
      <span className="font-mono">
        {formatZonedRange(item.startsAt, item.endsAt, timezone)}
      </span>
      <span className="w-full truncate">{itemTag(item)}</span>
    </button>
  );
}

export interface AgendaGridProps {
  date: string;
  timezone: string;
  fields: AgendaField[];
  hours: { weekday: number; openMinute: number; closeMinute: number }[];
  onOpen: AgendaItemHandler;
}

/**
 * Court × time table: one column per court, one row per 30 minutes of the
 * opening hours. Items span the rows they cover and are buttons that open the
 * detail. Real `<table>` with column and row headers.
 */
export function AgendaGrid({
  date,
  timezone,
  fields,
  hours,
  onOpen,
}: AgendaGridProps) {
  const placed = fields.flatMap((field) =>
    field.items.map((item) => placeItem(item, date, timezone)),
  );
  const rows = agendaRowMinutes(hours, date, placed);

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line p-6 text-muted">
        O espaço não abre neste dia e não há reservas.
      </p>
    );
  }

  const { cells: grid, overflow } = buildAgendaGrid(
    fields,
    rows,
    date,
    timezone,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-pl-20 overflow-x-auto rounded-card border border-line">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Agenda do dia, quadras por horário
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-20 border-b border-line bg-bg px-2 py-3 text-left text-sm font-semibold"
              >
                Horário
              </th>
              {fields.map((field) => (
                <th
                  key={field.id}
                  scope="col"
                  className="min-w-40 border-b border-l border-line px-3 py-3 text-left text-sm font-semibold"
                >
                  {field.name}
                  {field.isActive ? null : (
                    <span className="block text-xs font-normal text-muted">
                      Inativa
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((minute, rowIndex) => (
              <tr key={minute} className="h-14">
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-t border-line bg-bg px-2 text-left align-top font-mono text-xs font-normal text-muted"
                >
                  {formatMinute(minute)}
                </th>
                {fields.map((field, column) => {
                  const cell = grid[rowIndex]?.[column];
                  if (cell?.kind === 'covered') return null;
                  if (cell?.kind === 'item') {
                    return (
                      <td
                        key={field.id}
                        rowSpan={cell.span}
                        className="relative min-w-40 border-l border-t border-line align-top"
                      >
                        <ItemButton
                          item={cell.placed.item}
                          field={field}
                          timezone={timezone}
                          onOpen={onOpen}
                          layout="cell"
                        />
                      </td>
                    );
                  }
                  return (
                    <td
                      key={field.id}
                      className="min-w-40 border-l border-t border-line"
                    />
                  );
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
            className="rounded-card border border-line p-4"
          >
            <h3
              id={`agenda-outros-${field.id}`}
              className="mb-1 text-base font-bold"
            >
              {`Outros horários nesta quadra: ${field.name}`}
            </h3>
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
}

function byStart(a: AgendaItem, b: AgendaItem): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

/** Phone layout: one list per court, sorted by start. */
export function AgendaList({ timezone, fields, onOpen }: AgendaListProps) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const items = [...field.items].sort(byStart);
        return (
          <section
            key={field.id}
            aria-labelledby={`agenda-quadra-${field.id}`}
            className="rounded-card border border-line p-4"
          >
            <h3
              id={`agenda-quadra-${field.id}`}
              className="mb-3 text-base font-bold"
            >
              {field.name}
              {field.isActive ? null : (
                <span className="ml-2 text-xs font-normal text-muted">
                  Inativa
                </span>
              )}
            </h3>
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
