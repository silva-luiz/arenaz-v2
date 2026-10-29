import { WEEKDAY_LABELS, type PublicField } from '@arenaz/contracts';
import { formatPrice } from '@arenaz/ui';

type PriceRule = PublicField['priceRules'][number];

const MINUTES_PER_HOUR = 60;
/** A run of at least this many consecutive days is written "Seg a Sex". */
const MIN_RUN_TO_COLLAPSE = 3;
const DAYS_IN_WEEK = 7;

/** Minutes since midnight as "18h" or "18h30"; 1440 is "24h". */
export function formatClock(minute: number): string {
  const hours = Math.floor(minute / MINUTES_PER_HOUR);
  const minutes = minute % MINUTES_PER_HOUR;
  return minutes === 0
    ? `${String(hours)}h`
    : `${String(hours)}h${String(minutes).padStart(2, '0')}`;
}

/** "Seg", "Sáb": the first three letters of the weekday name (0 = Sunday). */
function shortWeekday(weekday: number): string {
  return (WEEKDAY_LABELS[weekday] ?? '').slice(0, 3);
}

/** "a, b e c" ("a e b" for two, "a" for one). */
function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1) ?? ''}`;
}

/** Position of a weekday (0 = Sunday) in a week that starts on Monday. */
function mondayFirst(weekday: number): number {
  return (weekday + 6) % DAYS_IN_WEEK;
}

/** Splits weekdays (sorted Monday first) into runs of consecutive days. */
function runsOf(sorted: number[]): number[][] {
  const runs: number[][] = [];
  for (const day of sorted) {
    const run = runs.at(-1);
    const previous = run?.at(-1);
    if (
      run &&
      previous !== undefined &&
      mondayFirst(previous) === mondayFirst(day) - 1
    ) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  return runs;
}

/**
 * The days of a price rule in words, the week starting on Monday as
 * Brazilians read it. Runs of 3 or more consecutive days collapse ("Seg a
 * Sex", "Sex a Dom": Sunday follows Saturday), the others are listed ("Seg,
 * Qua e Sex", "Sáb e Dom").
 */
function describeDays(weekdays: number[]): string {
  const sorted = [...new Set(weekdays)].sort(
    (a, b) => mondayFirst(a) - mondayFirst(b),
  );
  if (sorted.length === DAYS_IN_WEEK) return 'Todos os dias';

  const parts = runsOf(sorted).flatMap((run) => {
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) return [];
    return run.length >= MIN_RUN_TO_COLLAPSE
      ? [`${shortWeekday(first)} a ${shortWeekday(last)}`]
      : run.map(shortWeekday);
  });
  return joinList(parts);
}

/** "Sex e Sáb, 18h–23h: R$ 250 / hora" */
export function summarizePriceRule(rule: PriceRule): string {
  return `${describeDays(rule.weekdays)}, ${formatClock(rule.startMinute)}–${formatClock(rule.endMinute)}: ${formatPrice(rule.priceCentsPerHour)} / hora`;
}

/**
 * The lowest price per hour of a court: its base price or the cheapest of its
 * price rules. This is what "a partir de" means everywhere (the API's search
 * card uses the same definition).
 */
export function lowestPriceCents(
  field: Pick<PublicField, 'basePriceCentsPerHour' | 'priceRules'>,
): number {
  return Math.min(
    field.basePriceCentsPerHour,
    ...field.priceRules.map((rule) => rule.priceCentsPerHour),
  );
}
