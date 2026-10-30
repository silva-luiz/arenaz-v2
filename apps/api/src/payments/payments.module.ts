import { Module, type DynamicModule } from '@nestjs/common';
import { BookingsModule } from '../booking/bookings.module.js';
import { isFakePayment, type Env } from '../config/env.js';
import { FakePayment } from './fake.payment.js';
import { PAYMENT } from './payment.port.js';
import {
  FakePaymentsController,
  PaymentsController,
} from './payments.controller.js';

@Module({})
export class PaymentsModule {
  static forRoot(env: Env): DynamicModule {
    const fake = isFakePayment(env.PAYMENT_PROVIDER);
    return {
      module: PaymentsModule,
      imports: [BookingsModule],
      // The endpoint that confirms payments on demand exists only for the fake.
      controllers: fake
        ? [PaymentsController, FakePaymentsController]
        : [PaymentsController],
      providers: [{ provide: PAYMENT, useFactory: () => new FakePayment() }],
      exports: [PAYMENT],
    };
  }
}
