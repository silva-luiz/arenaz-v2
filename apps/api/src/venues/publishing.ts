import { schema } from '@arenaz/db';
import { UnprocessableEntityException } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import type { Reader } from './owner.js';

const { venue, venueHours, venuePhoto, field } = schema;

export const PUBLISH_INCOMPLETE_MESSAGE = 'Complete o espaço antes de publicar';
export const UNPUBLISH_FIRST_MESSAGE =
  'Despublique o espaço antes de deixá-lo incompleto';
export const PUBLISH_MISSING = {
  hours: 'Defina o horário de funcionamento',
  fields: 'Cadastre ao menos uma quadra ativa',
  photos: 'Envie ao menos uma foto',
} as const;

/**
 * What a venue still lacks to be publishable: opening hours, an active field
 * and a photo. Only the missing keys are present, each with its pt-BR message.
 */
export async function missingForPublish(
  tx: Reader,
  venueId: string,
): Promise<Partial<Record<keyof typeof PUBLISH_MISSING, string[]>>> {
  // Sequential: inside a transaction every query shares one connection.
  const [hours] = await tx
    .select({ total: count() })
    .from(venueHours)
    .where(eq(venueHours.venueId, venueId));
  const [activeFields] = await tx
    .select({ total: count() })
    .from(field)
    .where(and(eq(field.venueId, venueId), eq(field.isActive, true)));
  const [photos] = await tx
    .select({ total: count() })
    .from(venuePhoto)
    .where(eq(venuePhoto.venueId, venueId));
  const missing: Partial<Record<keyof typeof PUBLISH_MISSING, string[]>> = {};
  if (!hours?.total) missing.hours = [PUBLISH_MISSING.hours];
  if (!activeFields?.total) missing.fields = [PUBLISH_MISSING.fields];
  if (!photos?.total) missing.photos = [PUBLISH_MISSING.photos];
  return missing;
}

/**
 * Locks the venue row (`SELECT ... FOR UPDATE`) and returns its status, so
 * concurrent publish/mutation transactions run one after the other.
 */
export async function lockVenueStatus(
  tx: Reader,
  venueId: string,
): Promise<string | undefined> {
  const [row] = await tx
    .select({ status: venue.status })
    .from(venue)
    .where(eq(venue.id, venueId))
    .for('update');
  return row?.status;
}

/**
 * Call INSIDE the transaction of any mutation that can make a venue
 * incomplete (replacing hours, deactivating or deleting a field, deleting a
 * photo), after applying the change: a published venue must stay complete, so
 * the 422 rolls the change back. Draft venues are never blocked.
 */
export async function assertPublishedStaysComplete(
  tx: Reader,
  venueId: string,
): Promise<void> {
  const status = await lockVenueStatus(tx, venueId);
  if (status !== 'published') return;
  const errors = await missingForPublish(tx, venueId);
  if (Object.keys(errors).length > 0) {
    throw new UnprocessableEntityException({
      message: UNPUBLISH_FIRST_MESSAGE,
      errors,
    });
  }
}
