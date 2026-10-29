import type { BookingErrorCode } from '@arenaz/booking-core';
import {
  ConflictException,
  UnprocessableEntityException,
  type HttpException,
} from '@nestjs/common';
import { AVAILABILITY_HORIZON_DAYS } from '@arenaz/contracts';

export const BOOKING_NOT_FOUND = 'Reserva não encontrada';
export const CHARGE_NOT_FOUND = 'Cobrança não encontrada';
export const SLOT_TAKEN = 'Esse horário acabou de ser reservado';
export const TOO_MANY_HOLDS = 'Você já tem reservas aguardando pagamento';
export const HOLD_EXPIRED = 'O prazo para pagamento acabou';
export const ALREADY_PAID = 'Essa reserva já foi paga';
export const NOT_AWAITING_PAYMENT =
  'Essa reserva não está mais aguardando pagamento';
export const CANNOT_CANCEL = 'Essa reserva não pode ser cancelada';
export const CANCEL_TOO_LATE =
  'O cancelamento só é possível com pelo menos 24 horas de antecedência';
export const FIELD_HAS_BOOKINGS = 'Esta quadra tem reservas futuras';
export const VENUE_HAS_BOOKINGS = 'Este espaço tem reservas futuras';
export const FIELD_HAS_PAID_HISTORY =
  'Esta quadra tem histórico de reservas pagas. Desative-a em vez de excluir.';
export const VENUE_HAS_PAID_HISTORY =
  'Este espaço tem histórico de reservas pagas. Despublique-o em vez de excluir.';
export const BLOCK_OVER_BOOKING = 'Já existe uma reserva nesse período';
export const FIELD_INACTIVE = 'Esta quadra está desativada';
export const CANCELLED_HOLD = 'Reserva cancelada.';
export const CANCELLED_PAID =
  'Cancelada. O reembolso será tratado pelo suporte.';

/** Which request field a rule violation is reported on. */
const RULE_FIELD: Record<Exclude<BookingErrorCode, 'busy'>, string> = {
  past: 'startsAt',
  misaligned: 'startsAt',
  too_short: 'durationMinutes',
  closed: 'startsAt',
  too_far: 'startsAt',
};

/** The HTTP error of a failed `validateBooking` (busy is a 409, the rest 422). */
export function bookingRuleError(
  code: BookingErrorCode,
  minSlotMinutes: number,
): HttpException {
  if (code === 'busy') return new ConflictException(SLOT_TAKEN);
  const messages: Record<Exclude<BookingErrorCode, 'busy'>, string> = {
    past: 'Esse horário já passou',
    misaligned: 'Escolha um horário de 30 em 30 minutos',
    too_short: `A reserva mínima desta quadra é de ${String(minSlotMinutes)} minutos`,
    closed: 'O espaço está fechado nesse horário',
    too_far: `Só é possível reservar até ${String(AVAILABILITY_HORIZON_DAYS)} dias à frente`,
  };
  const message = messages[code];
  return new UnprocessableEntityException({
    message,
    errors: { [RULE_FIELD[code]]: [message] },
  });
}
