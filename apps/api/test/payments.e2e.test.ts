import {
  bookingSchema,
  paymentChargeSchema,
  type Problem,
} from '@arenaz/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { at, expireHold, seedVenue, spDate } from './booking-seed.js';
import { asUser, buildTestApp, signUpAs } from './helpers.js';

let app: NestFastifyApplication;
let handle: DbHandle;
let ownerId: string;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
  ({ userId: ownerId } = await signUpAs(app, 'Maria Dona Arena'));
});

afterAll(async () => {
  await app.close();
});

async function heldBooking() {
  const s = await seedVenue(handle, ownerId);
  const { cookie, userId } = await signUpAs(app, 'Joana Jogadora');
  const api = asUser(app, cookie);
  const date = spDate(3);
  const res = await api.post('/api/bookings', {
    fieldId: s.fieldId,
    startsAt: at(date, '09:00').toISOString(),
    durationMinutes: 120,
  });
  const created = bookingSchema.parse(res.json());
  return { s, api, userId, created };
}

describe('POST /api/bookings/:id/payment', () => {
  it('exige login', async () => {
    const { created } = await heldBooking();
    const res = await app.inject({
      method: 'POST',
      url: `/api/bookings/${created.id}/payment`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('gera a cobrança pix simulada para o valor e o prazo da reserva', async () => {
    const { api, created } = await heldBooking();
    const res = await api.post(`/api/bookings/${created.id}/payment`);
    expect(res.statusCode).toBe(201);
    const charge = paymentChargeSchema.parse(res.json());
    expect(charge.method).toBe('pix');
    expect(charge.simulatable).toBe(true);
    expect(charge.expiresAt).toBe(created.holdExpiresAt);
    expect(charge.qrCodeSvg.startsWith('<svg')).toBe(true);
    expect(charge.qrCodeSvg).not.toMatch(/<script|\son\w+=/i);
    expect(charge.copyPaste).toMatch(/^ARENAZ-FAKE-/);
    // Nothing real: no pix key, no e-mail, no booking data in the text.
    expect(charge.copyPaste).not.toContain(created.id);
  });

  it('pedir de novo devolve a mesma cobrança', async () => {
    const { api, created } = await heldBooking();
    const a = paymentChargeSchema.parse(
      (await api.post(`/api/bookings/${created.id}/payment`)).json(),
    );
    const b = paymentChargeSchema.parse(
      (await api.post(`/api/bookings/${created.id}/payment`)).json(),
    );
    expect(b.chargeId).toBe(a.chargeId);
    expect(b.copyPaste).toBe(a.copyPaste);
  });

  it('409 quando a reserva já foi paga, cancelada ou venceu', async () => {
    const paid = await heldBooking();
    const charge = paymentChargeSchema.parse(
      (await paid.api.post(`/api/bookings/${paid.created.id}/payment`)).json(),
    );
    await paid.api.post(`/api/payments/fake/${charge.chargeId}/pay`);
    const confirmed = await paid.api.post(
      `/api/bookings/${paid.created.id}/payment`,
    );
    expect(confirmed.statusCode).toBe(409);

    const cancelled = await heldBooking();
    await cancelled.api.post(`/api/bookings/${cancelled.created.id}/cancel`);
    expect(
      (
        await cancelled.api.post(
          `/api/bookings/${cancelled.created.id}/payment`,
        )
      ).statusCode,
    ).toBe(409);

    const late = await heldBooking();
    await expireHold(handle, late.created.id);
    const res = await late.api.post(`/api/bookings/${late.created.id}/payment`);
    expect(res.statusCode).toBe(409);
    expect(res.json<Problem>().detail).toBe('O prazo para pagamento acabou');
  });
});
