import {
  createBookingInputSchema,
  type Booking,
  type CancelBookingResponse,
  type CreateBookingInput,
  type NextBookingResponse,
} from '@arenaz/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import type { AuthUser } from '../auth/auth.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { BookingsService } from './bookings.service.js';

// Per route on top of the global limit (both off when NODE_ENV=test).
const WRITE_LIMIT = { rateLimit: { max: 20, timeWindow: '1 minute' } };

@Controller('bookings')
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @RouteConfig(WRITE_LIMIT)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createBookingInputSchema)) input: CreateBookingInput,
  ): Promise<Booking> {
    return this.bookings.create(user.id, input);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthUser): Promise<Booking[]> {
    return this.bookings.listMine(user.id);
  }

  // Player data: never cached on the way.
  @Header('Cache-Control', 'no-store')
  @Get('me/next')
  next(@CurrentUser() user: AuthUser): Promise<NextBookingResponse> {
    return this.bookings.nextConfirmed(user.id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Booking> {
    return this.bookings.get(user.id, id);
  }

  @RouteConfig(WRITE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<CancelBookingResponse> {
    return this.bookings.cancel(user.id, id);
  }
}
