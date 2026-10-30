import type { PaymentCharge } from '@arenaz/contracts';

/** DI token of the payment provider (`PaymentPort`). */
export const PAYMENT = Symbol('PAYMENT');

export interface CreateChargeInput {
  bookingId: string;
  /** Always the server-computed total of the booking. */
  amountCents: number;
  /** When the charge stops being payable (the hold's deadline). */
  expiresAt: Date;
}

export interface PaymentPort {
  /** A pix charge for the booking. Asking again for the same booking gives the same charge. */
  createCharge(input: CreateChargeInput): Promise<PaymentCharge>;
}
