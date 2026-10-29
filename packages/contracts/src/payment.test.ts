import { describe, expect, it } from 'vitest';
import { paymentChargeSchema, paymentResultSchema } from './payment.js';

const charge = {
  chargeId: 'fake_abc',
  method: 'pix',
  qrCodeSvg: '<svg></svg>',
  copyPaste: 'ARENAZ-FAKE-1',
  expiresAt: '2026-11-01T10:00:00.000Z',
  simulatable: true,
};

describe('paymentChargeSchema', () => {
  it('aceita uma cobrança pix', () => {
    expect(paymentChargeSchema.parse(charge)).toEqual(charge);
  });

  it.each([
    { method: 'card' },
    { qrCodeSvg: '' },
    { expiresAt: 'amanhã' },
    { simulatable: 'yes' },
  ])('rejeita %o', (patch) => {
    expect(paymentChargeSchema.safeParse({ ...charge, ...patch }).success).toBe(
      false,
    );
  });
});

describe('paymentResultSchema', () => {
  it('só diz que foi confirmada', () => {
    expect(paymentResultSchema.parse({ status: 'confirmed', x: 1 })).toEqual({
      status: 'confirmed',
    });
  });
});
