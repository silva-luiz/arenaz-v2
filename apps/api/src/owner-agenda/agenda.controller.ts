import {
  availabilityQuerySchema,
  manualBookingInputSchema,
  type AgendaBooking,
  type AvailabilityQuery,
  type ManualBookingInput,
  type OwnerAgenda,
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
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AgendaService } from './agenda.service.js';

// Bodies and queries are validated before a handler runs, so an invalid one
// gets the same 422 whoever owns the resource (no existence leak).
@Controller('owner')
@UseGuards(AuthGuard)
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  /** Names and phones of customers: never cached. */
  @Header('Cache-Control', 'no-store')
  @Get('venues/:id/agenda')
  day(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query(new ZodPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<OwnerAgenda> {
    return this.agenda.day(user.id, id, query.date);
  }

  @Post('fields/:id/bookings')
  createManual(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(manualBookingInputSchema)) input: ManualBookingInput,
  ): Promise<AgendaBooking> {
    return this.agenda.createManual(user.id, id, input);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<AgendaBooking> {
    return this.agenda.cancel(user.id, id);
  }
}
