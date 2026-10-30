import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller.js';
import { VenuesService } from './venues.service.js';

@Module({
  controllers: [VenuesController],
  providers: [VenuesService],
  // Fields and photos (Tasks 4-5) reuse the service's loader and mapper.
  exports: [VenuesService],
})
export class VenuesModule {}
