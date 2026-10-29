import type { BookingStatus } from '@arenaz/contracts';
import { BOOKING_STATUS_LABELS } from '@arenaz/contracts';
import { Badge, type BadgeTone } from '@arenaz/ui';

const TONES: Record<BookingStatus, BadgeTone> = {
  held: 'warning',
  confirmed: 'free',
  cancelled: 'neutral',
  expired: 'neutral',
};

/** The status of a booking as text (never colour alone). */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={TONES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}
