import {
  venueHoursSchema,
  venueInputSchema,
  venueUpdateSchema,
  type Venue,
  type VenueHours,
  type VenueInput,
  type VenueSummary,
  type VenueUpdate,
} from '@arenaz/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { VenuesService } from './venues.service.js';

@Controller('owner/venues')
@UseGuards(AuthGuard)
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<VenueSummary[]> {
    return this.venues.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(venueInputSchema)) input: VenueInput,
  ): Promise<Venue> {
    return this.venues.create(user.id, input);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Venue> {
    return this.venues.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(venueUpdateSchema)) input: VenueUpdate,
  ): Promise<Venue> {
    return this.venues.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.venues.remove(user.id, id);
  }

  @Put(':id/hours')
  replaceHours(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(venueHoursSchema)) hours: VenueHours,
  ): Promise<Venue> {
    return this.venues.replaceHours(user.id, id, hours);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Venue> {
    return this.venues.publish(user.id, id);
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<Venue> {
    return this.venues.unpublish(user.id, id);
  }
}
