import {
  availabilityQuerySchema,
  type Availability,
  type AvailabilityQuery,
} from '@arenaz/contracts';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ZodPipe } from '../common/zod.pipe.js';
import { AvailabilityService } from './availability.service.js';

// Same limit as the other public routes (off in NODE_ENV=test; the SSR
// internal token is exempt through the global allowList).
const PUBLIC_RATE_LIMIT = { rateLimit: { max: 60, timeWindow: '1 minute' } };

@Controller('venues')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /** Free slots change with every booking: never cached. */
  @RouteConfig(PUBLIC_RATE_LIMIT)
  @Header('Cache-Control', 'no-store')
  @Get(':slug/availability')
  day(
    @Param('slug') slug: string,
    @Query(new ZodPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ): Promise<Availability> {
    return this.availability.day(slug, query.date);
  }
}
