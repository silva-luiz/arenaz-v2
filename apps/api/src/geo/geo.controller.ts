import { cepSchema, type CepLookupResponse } from '@arenaz/contracts';
import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard.js';
import { PublicServiceUnavailableException } from '../common/public-service-unavailable.exception.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { GEO, GeoUnavailableError, type GeoPort } from './geo.port.js';

// Wrapped in an object so a bad value is reported under the `cep` field.
const cepParamSchema = z.object({ cep: cepSchema });

// The web panel autofills the address and the map pin from this route.
@Controller('geo')
@UseGuards(AuthGuard)
export class GeoController {
  constructor(@Inject(GEO) private readonly geo: GeoPort) {}

  // Stricter than the global limiter (and, like it, off in NODE_ENV=test).
  @RouteConfig({ rateLimit: { max: 30, timeWindow: '1 minute' } })
  @Get('cep/:cep')
  async lookup(
    @Param(new ZodPipe(cepParamSchema))
    { cep }: z.output<typeof cepParamSchema>,
  ): Promise<CepLookupResponse> {
    let found: CepLookupResponse | null;
    try {
      found = await this.geo.lookupCep(cep);
    } catch (error) {
      if (error instanceof GeoUnavailableError) {
        throw new PublicServiceUnavailableException(
          'Serviço de CEP indisponível, tente de novo',
        );
      }
      throw error;
    }
    if (found === null) throw new NotFoundException('CEP não encontrado');
    return found;
  }
}
