'use client';

import {
  MAX_VENUE_HOURS,
  WEEKDAY_LABELS,
  venueHoursSchema,
  venueSchema,
  type VenueHours,
} from '@arenaz/contracts';
import { Alert, Button, Checkbox, Select } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { formatMinute } from '@/lib/format-br';
import { TIME_OPTIONS } from './time-options';

const DEFAULT_OPEN = 8 * 60;
const DEFAULT_CLOSE = 22 * 60;
const DAY_END = 24 * 60;
/** Length of an interval added with "+ Intervalo". */
const NEW_INTERVAL_MINUTES = 3 * 60;
/** "Vira a madrugada até": 00:30 to 08:00. */
const OVERNIGHT_OPTIONS = TIME_OPTIONS.filter(
  (option) => Number(option.value) >= 30 && Number(option.value) <= 8 * 60,
);

interface IntervalState {
  /** Stable React key; never sent to the API. */
  key: number;
  openMinute: number;
  closeMinute: number;
}

interface DayState {
  open: boolean;
  intervals: IntervalState[];
}

/** React keys for interval rows (stable while rows are added and removed). */
let lastKey = 0;
const newKey = (): number => ++lastKey;

type Notice = { tone: 'error' | 'success'; text: string } | null;

/** Where an error belongs: `${weekday}:${position within the day}`. */
const errorKey = (weekday: number, position: number): string =>
  `${String(weekday)}:${String(position)}`;

export interface HoursEditorProps {
  venueId: string;
  initialHours: VenueHours;
}

/**
 * Seven days, Domingo to Sábado, each with one or more intervals (a closed
 * day is simply absent from the payload). A shift past midnight is two
 * intervals: "Vira a madrugada até" creates the second one on the next day.
 */
export function HoursEditor({ venueId, initialHours }: HoursEditorProps) {
  const router = useRouter();
  const [days, setDays] = useState<DayState[]>(() =>
    WEEKDAY_LABELS.map((_, weekday) => {
      const saved = initialHours
        .filter((hour) => hour.weekday === weekday)
        .sort((a, b) => a.openMinute - b.openMinute);
      return saved.length > 0
        ? {
            open: true,
            intervals: saved.map((hour) => ({
              key: newKey(),
              openMinute: hour.openMinute,
              closeMinute: hour.closeMinute,
            })),
          }
        : {
            open: false,
            intervals: [
              {
                key: newKey(),
                openMinute: DEFAULT_OPEN,
                closeMinute: DEFAULT_CLOSE,
              },
            ],
          };
    }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  // Polite live region: changes made to a day other than the one being edited.
  const [announcement, setAnnouncement] = useState('');
  const form = useRef<HTMLFormElement>(null);
  // Where the focus goes once the next render is committed: "interval:W:P"
  // (first control of that interval) or "add:W" (the day's add button).
  const pendingFocus = useRef<string | null>(null);

  // Removing unmounts the focused button, so focus is placed after the commit.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const [kind, weekday, position] = target.split(':');
    const day = form.current?.querySelector<HTMLElement>(
      `[data-day="${weekday ?? ''}"]`,
    );
    if (kind === 'interval') {
      day
        ?.querySelector<HTMLElement>(
          `[data-interval="${position ?? ''}"] select`,
        )
        ?.focus();
      return;
    }
    const add = day?.querySelector<HTMLButtonElement>('[data-add]');
    // A day that already ends at 24:00 has its add button disabled.
    (add && !add.disabled
      ? add
      : day?.querySelector<HTMLElement>('select')
    )?.focus();
  });

  const total = days.reduce(
    (sum, day) => sum + (day.open ? day.intervals.length : 0),
    0,
  );

  /** Applies `change` to the days and forgets the errors (they may be stale). */
  function edit(change: (current: DayState[]) => DayState[]) {
    setDays(change);
    setNotice(null);
    setErrors({});
  }

  function editDay(weekday: number, change: (day: DayState) => DayState) {
    edit((current) =>
      current.map((day, index) => (index === weekday ? change(day) : day)),
    );
  }

  function editInterval(
    weekday: number,
    position: number,
    patch: Partial<IntervalState>,
  ) {
    editDay(weekday, (day) => ({
      ...day,
      intervals: day.intervals.map((item, index) =>
        index === position ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addInterval(weekday: number) {
    editDay(weekday, (day) => {
      const base = Math.max(...day.intervals.map((item) => item.closeMinute));
      return {
        ...day,
        intervals: [
          ...day.intervals,
          {
            key: newKey(),
            openMinute: base,
            closeMinute: Math.min(base + NEW_INTERVAL_MINUTES, DAY_END),
          },
        ],
      };
    });
  }

  function removeInterval(weekday: number, position: number) {
    pendingFocus.current =
      position > 0
        ? `interval:${String(weekday)}:${String(position - 1)}`
        : `add:${String(weekday)}`;
    editDay(weekday, (day) => ({
      ...day,
      intervals: day.intervals.filter((_, index) => index !== position),
    }));
  }

  /**
   * The (last) interval of the day runs to 24:00 and the next weekday gets
   * 00:00 to `until`: an existing 00:00 interval there is kept when it already
   * reaches `until`, extended when it falls short, and a new one is added
   * otherwise (a closed day is opened). The change is announced.
   */
  function overnight(weekday: number, until: number) {
    const nextDay = (weekday + 1) % WEEKDAY_LABELS.length;
    const dayName = (WEEKDAY_LABELS[nextDay] ?? '').toLowerCase();
    const target = days[nextDay];
    const midnight = target?.open
      ? target.intervals.find((item) => item.openMinute === 0)
      : undefined;
    const range = `00:00–${formatMinute(until)}`;
    if (midnight && midnight.closeMinute >= until) {
      setAnnouncement(
        `${dayName} já tem o intervalo ${formatMinute(0)}–${formatMinute(midnight.closeMinute)}, mantido`,
      );
    } else if (midnight) {
      setAnnouncement(`Intervalo ${range} estendido em ${dayName}`);
    } else {
      setAnnouncement(`Intervalo ${range} adicionado em ${dayName}`);
    }

    edit((current) =>
      current.map((day, index) => {
        if (index === weekday) {
          // Only the last interval offers the shortcut.
          return {
            ...day,
            intervals: day.intervals.map((item, at) =>
              at === day.intervals.length - 1
                ? { ...item, closeMinute: DAY_END }
                : item,
            ),
          };
        }
        if (index !== nextDay) return day;
        const intervals = day.open ? day.intervals : [];
        const first = intervals.find((item) => item.openMinute === 0);
        if (first && first.closeMinute >= until) return { ...day, open: true };
        return {
          open: true,
          intervals: first
            ? intervals.map((item) =>
                item === first ? { ...item, closeMinute: until } : item,
              )
            : [
                { key: newKey(), openMinute: 0, closeMinute: until },
                ...intervals,
              ],
        };
      }),
    );
  }

  async function save() {
    setNotice(null);
    setErrors({});

    // The schema reports positions in the payload, which only holds open
    // days; `origin` maps each one back to its row.
    const entries = days.flatMap((day, weekday) =>
      day.open
        ? day.intervals.map((item, position) => ({
            weekday,
            position,
            openMinute: item.openMinute,
            closeMinute: item.closeMinute,
          }))
        : [],
    );
    const payload = entries.map(({ weekday, openMinute, closeMinute }) => ({
      weekday,
      openMinute,
      closeMinute,
    }));
    const keyAt = (index: number): string | undefined => {
      const entry = entries[index];
      return entry ? errorKey(entry.weekday, entry.position) : undefined;
    };

    const parsed = venueHoursSchema.safeParse(payload);
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[0];
        const key = typeof index === 'number' ? keyAt(index) : undefined;
        if (key !== undefined && found[key] === undefined) {
          found[key] = issue.message;
        }
      }
      setErrors(found);
      setNotice({
        tone: 'error',
        text:
          Object.keys(found).length > 0
            ? 'Corrija os horários destacados.'
            : (parsed.error.issues[0]?.message ??
              'Corrija os horários destacados.'),
      });
      return;
    }

    setSaving(true);
    const result = await apiSend(
      'PUT',
      `/owner/venues/${venueId}/hours`,
      parsed.data,
      venueSchema,
    );
    setSaving(false);

    if (!result.ok) {
      const found: Record<string, string> = {};
      for (const [index, messages] of Object.entries(result.fieldErrors)) {
        const key = keyAt(Number(index));
        if (key !== undefined && messages[0] !== undefined) {
          found[key] = messages[0];
        }
      }
      setErrors(found);
      setNotice({ tone: 'error', text: result.message });
      return;
    }
    setNotice({ tone: 'success', text: 'Horário salvo' });
    router.refresh();
  }

  return (
    <form
      ref={form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col divide-y divide-line">
        {days.map((day, weekday) => {
          const label = WEEKDAY_LABELS[weekday] ?? '';
          return (
            <fieldset
              key={label}
              data-day={weekday}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:gap-x-6"
            >
              <legend className="sr-only">{label}</legend>
              <div className="flex items-center gap-x-6 sm:min-h-10">
                <span aria-hidden="true" className="w-20 font-semibold">
                  {label}
                </span>
                <Checkbox
                  label="Aberto"
                  checked={day.open}
                  onChange={(event) => {
                    editDay(weekday, (current) => ({
                      ...current,
                      open: event.target.checked,
                    }));
                  }}
                />
              </div>
              {day.open ? (
                <div className="flex flex-col gap-3">
                  {day.intervals.map((item, position) => {
                    const number = String(position + 1);
                    const error = errors[errorKey(weekday, position)];
                    const errorId = `hours-${String(weekday)}-${number}-error`;
                    return (
                      <div
                        key={item.key}
                        data-interval={position}
                        role="group"
                        aria-label={`Intervalo ${number}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <Select
                          aria-label="Abertura"
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          options={TIME_OPTIONS}
                          value={String(item.openMinute)}
                          className="h-10 w-28"
                          onChange={(event) => {
                            editInterval(weekday, position, {
                              openMinute: Number(event.target.value),
                            });
                          }}
                        />
                        <span aria-hidden="true">às</span>
                        <Select
                          aria-label="Fechamento"
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? errorId : undefined}
                          options={TIME_OPTIONS}
                          value={String(item.closeMinute)}
                          className="h-10 w-28"
                          onChange={(event) => {
                            editInterval(weekday, position, {
                              closeMinute: Number(event.target.value),
                            });
                          }}
                        />
                        {position === day.intervals.length - 1 ? (
                          <Select
                            aria-label="Vira a madrugada até"
                            options={OVERNIGHT_OPTIONS}
                            placeholder="Vira a madrugada até"
                            value=""
                            className="h-10 w-52"
                            onChange={(event) => {
                              overnight(weekday, Number(event.target.value));
                            }}
                          />
                        ) : null}
                        {day.intervals.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover intervalo ${number} de ${label}`}
                            onClick={() => {
                              removeInterval(weekday, position);
                            }}
                          >
                            <span aria-hidden="true">Remover</span>
                          </Button>
                        ) : null}
                        {error ? (
                          <p
                            id={errorId}
                            className="w-full text-sm text-red-700"
                          >
                            {error}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    data-add=""
                    aria-label={`+ Intervalo (${label})`}
                    disabled={
                      total >= MAX_VENUE_HOURS ||
                      Math.max(...day.intervals.map((i) => i.closeMinute)) >=
                        DAY_END
                    }
                    onClick={() => {
                      addInterval(weekday);
                    }}
                  >
                    <span aria-hidden="true">+ Intervalo</span>
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted sm:min-h-10 sm:leading-10">
                  Fechado
                </span>
              )}
            </fieldset>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
      <Button type="submit" loading={saving} className="self-start">
        Salvar horário
      </Button>
    </form>
  );
}
