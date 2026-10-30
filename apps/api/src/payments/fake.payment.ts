import { createHash } from 'node:crypto';
import type { PaymentCharge } from '@arenaz/contracts';
import { renderSVG } from 'uqr';
import type { CreateChargeInput, PaymentPort } from './payment.port.js';

const CHARGE_PREFIX = 'fake_';
const CHARGE_ID =
  /^fake_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/**
 * Simulated pix: no money, no bank, no real key. The QR code encodes a made-up
 * "ARENAZ-FAKE-..." text. The charge id is derived from the booking, so the
 * fake webhook can find it back without storing anything.
 */
export class FakePayment implements PaymentPort {
  createCharge(input: CreateChargeInput): Promise<PaymentCharge> {
    const token = createHash('sha256')
      .update(`arenaz-fake:${input.bookingId}`)
      .digest('hex')
      .slice(0, 24)
      .toUpperCase();
    const copyPaste = `ARENAZ-FAKE-${token}`;
    return Promise.resolve({
      chargeId: `${CHARGE_PREFIX}${input.bookingId}`,
      method: 'pix',
      qrCodeSvg: renderSVG(copyPaste),
      copyPaste,
      expiresAt: input.expiresAt.toISOString(),
      simulatable: true,
    });
  }

  /** The booking a fake charge id belongs to; null for anything else. */
  static bookingIdOf(chargeId: string): string | null {
    return CHARGE_ID.exec(chargeId)?.[1] ?? null;
  }
}
