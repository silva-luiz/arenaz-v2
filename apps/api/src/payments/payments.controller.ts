import type { PaymentCharge, PaymentResult } from '@arenaz/contracts';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { AuthUser } from '../auth/auth.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CHARGE_NOT_FOUND } from '../booking/booking-errors.js';
import { BookingsService } from '../booking/bookings.service.js';
import { FakePayment } from './fake.payment.js';
import { PAYMENT, type PaymentPort } from './payment.port.js';

const LIMIT = { rateLimit: { max: 20, timeWindow: '1 minute' } };

@Controller('bookings')
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(
    private readonly bookings: BookingsService,
    @Inject(PAYMENT) private readonly payment: PaymentPort,
  ) {}

  /** The amount and deadline come from the booking, never from the request. */
  @RouteConfig(LIMIT)
  @Post(':id/payment')
  async charge(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<PaymentCharge> {
    const target = await this.bookings.chargeable(user.id, id);
    return this.payment.createCharge({
      bookingId: target.id,
      amountCents: target.totalCents,
      expiresAt: target.holdExpiresAt,
    });
  }
}

/**
 * The simulated provider's "Simular pagamento". Unlike a real provider's
 * webhook it is called from the browser, so it needs the player's session and
 * only confirms that player's own booking. Registered only when
 * `PAYMENT_PROVIDER=fake` (see `PaymentsModule`).
 */
@Controller('payments/fake')
@UseGuards(AuthGuard)
export class FakePaymentsController {
  constructor(private readonly bookings: BookingsService) {}

  @RouteConfig(LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post(':chargeId/pay')
  async pay(
    @CurrentUser() user: AuthUser,
    @Param('chargeId') chargeId: string,
  ): Promise<PaymentResult> {
    const bookingId = FakePayment.bookingIdOf(chargeId);
    if (bookingId === null) throw new NotFoundException(CHARGE_NOT_FOUND);
    await this.bookings.confirmPaid(user.id, bookingId);
    return { status: 'confirmed' };
  }
}
