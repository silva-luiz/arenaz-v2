import { z } from 'zod';
import { timezoneSchema } from './timezone.js';

/** How many days ahead (counting from today in the venue's zone) can be queried. */
export const AVAILABILITY_HORIZON_DAYS = 60;

const DATE_INVALID = 'Data inválida. Use o formato AAAA-MM-DD';

/** `YYYY-MM-DD` that exists in the calendar (no 2026-02-30). */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `GET /venues/:slug/availability` query string. */
export const availabilityQuerySchema = z.object({
  date: z
    .string({ error: DATE_INVALID })
    .refine(isCalendarDate, { error: DATE_INVALID }),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

const instant = z.iso.datetime({
  offset: true,
  error: 'Data e hora inválidas',
});

/**
 * One bookable start. Deliberately no booking id, user, status or block
 * reason: a taken slot is just `available: false`.
 */
export const availabilitySlotSchema = z.object({
  startsAt: instant,
  endsAt: instant,
  available: z.boolean(),
  priceCents: z.number().int().nonnegative(),
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityFieldSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  minSlotMinutes: z.number().int().positive(),
  slots: z.array(availabilitySlotSchema),
});
export type AvailabilityField = z.infer<typeof availabilityFieldSchema>;

export const availabilitySchema = z.object({
  date: z.string().refine(isCalendarDate),
  timezone: timezoneSchema,
  fields: z.array(availabilityFieldSchema),
});
export type Availability = z.infer<typeof availabilitySchema>;
