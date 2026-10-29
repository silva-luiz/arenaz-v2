'use client';

import {
  WEEKDAY_LABELS,
  venueHoursSchema,
  venueSchema,
  type VenueHours,
} from '@arenaz/contracts';
import { Alert, Button, Checkbox, Select, type SelectOption } from '@arenaz/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiSend } from '@/lib/api-client';
import { formatMinute } from '@/lib/format-br';

const DEFAULT_OPEN = 8 * 60;
const DEFAULT_CLOSE = 22 * 60;
const STEP = 30;
const DAY_END = 24 * 60;

const TIME_OPTIONS: SelectOption[] = Array.from(
  { length: DAY_END / STEP + 1 },
  (_, index) => ({
    value: String(index * STEP),
    label: formatMinute(index * STEP),
  }),
);

interface DayState {
  open: boolean;
  openMinute: number;
  closeMinute: number;
}

type Notice = { tone: 'error' | 'success'; text: string } | null;

function initialDays(hours: VenueHours): DayState[] {
  return WEEKDAY_LABELS.map((_, weekday) => {
    const found = hours.find((hour) => hour.weekday === weekday);
    return found
      ? {
          open: true,
          openMinute: found.openMinute,
          closeMinute: found.closeMinute,
        }
      : { open: false, openMinute: DEFAULT_OPEN, closeMinute: DEFAULT_CLOSE };
  });
}

export interface HoursEditorProps {
  venueId: string;
  initialHours: VenueHours;
}

/** Seven rows, Domingo to Sábado; a closed day is simply absent from the payload. */
export function HoursEditor({ venueId, initialHours }: HoursEditorProps) {
  const router = useRouter();
  const [days, setDays] = useState(() => initialDays(initialHours));
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  function update(weekday: number, patch: Partial<DayState>) {
    setDays((current) =>
      current.map((day, index) =>
        index === weekday ? { ...day, ...patch } : day,
      ),
    );
    setNotice(null);
    setRowErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => Number(key) !== weekday),
      ),
    );
  }

  async function save() {
    setNotice(null);
    setRowErrors({});

    // The schema reports positions in the payload, which only holds open days.
    const payload = days.flatMap((day, weekday) =>
      day.open
        ? [
            {
              weekday,
              openMinute: day.openMinute,
              closeMinute: day.closeMinute,
            },
          ]
        : [],
    );
    const weekdayAt = (index: number): number | undefined =>
      payload[index]?.weekday;

    const parsed = venueHoursSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<number, string> = {};
      for (const issue of parsed.error.issues) {
        const index = issue.path[0];
        const weekday =
          typeof index === 'number' ? weekdayAt(index) : undefined;
        if (weekday !== undefined && errors[weekday] === undefined) {
          errors[weekday] = issue.message;
        }
      }
      setRowErrors(errors);
      setNotice({ tone: 'error', text: 'Corrija os horários destacados.' });
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
      const errors: Record<number, string> = {};
      for (const [key, messages] of Object.entries(result.fieldErrors)) {
        const weekday = weekdayAt(Number(key));
        if (weekday !== undefined && messages[0] !== undefined) {
          errors[weekday] = messages[0];
        }
      }
      setRowErrors(errors);
      setNotice({ tone: 'error', text: result.message });
      return;
    }
    setNotice({ tone: 'success', text: 'Horário salvo' });
    router.refresh();
  }

  return (
    <form
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
          const error = rowErrors[weekday];
          const errorId = `hours-${String(weekday)}-error`;
          return (
            <fieldset
              key={label}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3"
            >
              <legend className="sr-only">{label}</legend>
              <span aria-hidden="true" className="w-20 font-semibold">
                {label}
              </span>
              <Checkbox
                label="Aberto"
                checked={day.open}
                onChange={(event) => {
                  update(weekday, { open: event.target.checked });
                }}
              />
              {day.open ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Abertura"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    options={TIME_OPTIONS}
                    value={String(day.openMinute)}
                    className="h-10 w-28"
                    onChange={(event) => {
                      update(weekday, {
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
                    value={String(day.closeMinute)}
                    className="h-10 w-28"
                    onChange={(event) => {
                      update(weekday, {
                        closeMinute: Number(event.target.value),
                      });
                    }}
                  />
                </div>
              ) : (
                <span className="text-sm text-muted">Fechado</span>
              )}
              {error ? (
                <p id={errorId} className="w-full text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </fieldset>
          );
        })}
      </div>
      <Alert tone={notice?.tone ?? 'error'}>{notice?.text}</Alert>
      <Button type="submit" loading={saving} className="self-start">
        Salvar horário
      </Button>
    </form>
  );
}
