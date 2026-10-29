import { z } from 'zod';
import { timezoneSchema } from './timezone.js';

export const BOOKING_STATUSES = [
  'held',
  'confirmed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  held: 'Aguardando pagamento',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const BOOKING_MIN_MINUTES = 30;
export const BOOKING_MAX_MINUTES = 360;

const isoWithOffset = z.iso.datetime({
  offset: true,
  error: 'Data e hora inválidas',
});

/** What the player asks for: the price is always computed by the server. */
export const createBookingInputSchema = z.object({
  fieldId: z.uuid({ error: 'Quadra inválida' }),
  startsAt: isoWithOffset,
  durationMinutes: z
    .number({ error: 'Duração inválida' })
    .int('Duração inválida')
    .min(BOOKING_MIN_MINUTES, 'A reserva dura pelo menos 30 minutos')
    .max(BOOKING_MAX_MINUTES, 'A reserva dura no máximo 6 horas')
    .multipleOf(30, 'A duração precisa ser múltipla de 30 minutos'),
});
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

/** Exact address: only shown to the owner of a confirmed booking. */
const bookingAddressSchema = z.object({
  street: z.string(),
  number: z.string(),
  complement: z.string().nullable(),
  cep: z.string(),
});

/** The player's view of a booking. */
export const bookingSchema = z.object({
  id: z.uuid(),
  status: z.enum(BOOKING_STATUSES),
  startsAt: isoWithOffset,
  endsAt: isoWithOffset,
  totalCents: z.number().int().positive(),
  holdExpiresAt: isoWithOffset.nullable(),
  venue: z.object({
    slug: z.string(),
    name: z.string(),
    neighborhood: z.string(),
    city: z.string(),
    timezone: timezoneSchema,
  }),
  field: z.object({ id: z.uuid(), name: z.string() }),
  address: bookingAddressSchema.nullable(),
});
export type Booking = z.infer<typeof bookingSchema>;
