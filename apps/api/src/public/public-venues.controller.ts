import {
  publicSearchQuerySchema,
  type PublicSearchQuery,
  type PublicSearchResponse,
  type PublicVenue,
} from '@arenaz/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ZodPipe } from '../common/zod.pipe.js';
import { PublicVenuesService } from './public-venues.service.js';

// Player discovery needs no login. Stricter than the global limiter (and, like
// it, off in NODE_ENV=test).
const PUBLIC_RATE_LIMIT = { rateLimit: { max: 60, timeWindow: '1 minute' } };

@Controller('venues')
export class PublicVenuesController {
  constructor(private readonly venues: PublicVenuesService) {}

  @RouteConfig(PUBLIC_RATE_LIMIT)
  @Get()
  search(
    @Query(new ZodPipe(publicSearchQuerySchema)) query: PublicSearchQuery,
  ): Promise<PublicSearchResponse> {
    return this.venues.search(query);
  }

  @RouteConfig(PUBLIC_RATE_LIMIT)
  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<PublicVenue> {
    return this.venues.detail(slug);
  }
}
