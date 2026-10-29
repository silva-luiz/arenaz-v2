import type { SelectOption } from '@arenaz/ui';
import { formatMinute } from '@/lib/format-br';

const STEP = 30;
const DAY_END = 24 * 60;

/** Every 30 minutes from 00:00 to 24:00; the value is the minute of the day. */
export const TIME_OPTIONS: SelectOption[] = Array.from(
  { length: DAY_END / STEP + 1 },
  (_, index) => ({
    value: String(index * STEP),
    label: formatMinute(index * STEP),
  }),
);
