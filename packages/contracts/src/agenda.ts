import { z } from 'zod';
import {
  BOOKING_MAX_MINUTES,
  BOOKING_MIN_MINUTES,
  BOOKING_STATUSES,
} from './booking.js';
import { phoneBrSchema } from './common.js';
import { timezoneSchema } from './timezone.js';

const isoWithOffset = z.iso.datetime({
  offset: true,
  error: 'Data e hora inválidas',
});

/** A booking the owner makes by hand (phone, counter, WhatsApp). */
export const manualBookingInputSchema = z.object({
  startsAt: isoWithOffset,
  durationMinutes: z
    .number({ error: 'Duração inválida' })
    .int('Duração inválida')
    .min(BOOKING_MIN_MINUTES, 'A reserva dura pelo menos 30 minutos')
    .max(BOOKING_MAX_MINUTES, 'A reserva dura no máximo 6 horas')
    .multipleOf(30, 'A duração precisa ser múltipla de 30 minutos'),
  customerName: z
    .string({ error: 'Informe o nome do cliente' })
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres')
    .max(80, 'O nome pode ter no máximo 80 caracteres'),
  // A blank phone field means "no phone".
  customerPhone: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    phoneBrSchema.optional(),
  ),
});
export type ManualBookingInput = z.infer<typeof manualBookingInputSchema>;

/** A booking in the owner's agenda (only confirmed and live holds show up). */
export const agendaBookingSchema = z.object({
  kind: z.literal('booking'),
  id: z.uuid(),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset,
  status: z.enum(BOOKING_STATUSES),
  origin: z.enum(['app', 'manual']),
  /** Player: first name and surname initial. Manual: the typed name. */
  customerName: z.string(),
  /** Only manual bookings carry a phone (the owner typed it). */
  customerPhone: z.string().nullable(),
  totalCents: z.number().int().positive(),
});
export type AgendaBooking = z.infer<typeof agendaBookingSchema>;

export const agendaBlockSchema = z.object({
  kind: z.literal('block'),
  id: z.uuid(),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset,
  reason: z.string().nullable(),
});
export type AgendaBlock = z.infer<typeof agendaBlockSchema>;

export const agendaItemSchema = z.discriminatedUnion('kind', [
  agendaBookingSchema,
  agendaBlockSchema,
]);
export type AgendaItem = z.infer<typeof agendaItemSchema>;

export const ownerAgendaSchema = z.object({
  date: z.string(),
  timezone: timezoneSchema,
  fields: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      isActive: z.boolean(),
      items: z.array(agendaItemSchema),
    }),
  ),
});
export type OwnerAgenda = z.infer<typeof ownerAgendaSchema>;

/**
 * `GET /owner/venues/:id/summary?date=`: the owner's numbers of a day, in the
 * venue's zone. `occupancyPct`: minutes of active bookings (confirmed, or held
 * and alive) inside the opening hours of the day, over the open minutes of
 * every active court, rounded. `weekRevenueCents`: confirmed app bookings
 * starting in the Monday–Sunday week of the date.
 */
export const ownerVenueSummarySchema = z.object({
  occupancyPct: z.number().int().min(0).max(100),
  weekRevenueCents: z.number().int().nonnegative(),
});
export type OwnerVenueSummary = z.infer<typeof ownerVenueSummarySchema>;
