import { z } from 'zod';
import { AMENITIES, CANCELLATION_POLICIES } from './catalog.js';
import { phoneBrSchema } from './common.js';
import { fieldSummarySchema } from './field.js';
import {
  addressResponseSchema,
  addressSchema,
  locationSchema,
  minuteOfDaySchema,
} from './geo.js';
import { photoSchema } from './photo.js';

export const venueInputSchema = z.object({
  name: z
    .string({ error: 'Informe o nome do espaço' })
    .trim()
    .min(3, 'O nome precisa ter pelo menos 3 caracteres')
    .max(80, 'O nome pode ter no máximo 80 caracteres'),
  description: z
    .string()
    .max(2000, 'A descrição pode ter no máximo 2000 caracteres')
    .optional(),
  phone: phoneBrSchema,
  address: addressSchema,
  location: locationSchema,
  amenities: z
    .array(z.enum(AMENITIES, { error: 'Comodidade inválida' }))
    .refine((items) => new Set(items).size === items.length, {
      error: 'Comodidades repetidas',
    }),
  cancellationPolicy: z.enum(CANCELLATION_POLICIES, {
    error: 'Selecione a política de cancelamento',
  }),
});

export const venueUpdateSchema = venueInputSchema.partial();

export const VENUE_HOURS_MESSAGE =
  'O fechamento precisa ser depois da abertura';

const venueHourSchema = z
  .object({
    weekday: z
      .number({ error: 'Dia da semana inválido' })
      .int({ error: 'Dia da semana inválido' })
      .min(0, { error: 'Dia da semana inválido' })
      .max(6, { error: 'Dia da semana inválido' }),
    openMinute: minuteOfDaySchema,
    closeMinute: minuteOfDaySchema,
  })
  .refine((hour) => hour.openMinute < hour.closeMinute, {
    error: VENUE_HOURS_MESSAGE,
    path: ['closeMinute'],
  });

/** Opening hours, at most one entry per weekday (0 = Sunday). */
export const venueHoursSchema = z
  .array(venueHourSchema)
  .superRefine((hours, ctx) => {
    const seen = new Set<number>();
    hours.forEach((hour, index) => {
      if (seen.has(hour.weekday)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Dia da semana repetido',
          path: [index, 'weekday'],
        });
      }
      seen.add(hour.weekday);
    });
  });

export const venueStatusSchema = z.enum(['draft', 'published']);

export const venueSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string(),
  address: addressResponseSchema,
  location: locationSchema,
  amenities: z.array(z.enum(AMENITIES)),
  cancellationPolicy: z.enum(CANCELLATION_POLICIES),
  status: venueStatusSchema,
  hours: venueHoursSchema,
  photos: z.array(photoSchema),
  fields: z.array(fieldSummarySchema),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

/** Row of the owner's venue list. */
export const venueSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  status: venueStatusSchema,
  city: z.string(),
  fieldsCount: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
});

export type VenueInput = z.infer<typeof venueInputSchema>;
export type VenueUpdate = z.infer<typeof venueUpdateSchema>;
export type VenueHours = z.infer<typeof venueHoursSchema>;
export type VenueStatus = z.infer<typeof venueStatusSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type VenueSummary = z.infer<typeof venueSummarySchema>;
