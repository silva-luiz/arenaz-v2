import { Module } from '@nestjs/common';
import { PublicVenuesController } from './public-venues.controller.js';
import { PublicVenuesService } from './public-venues.service.js';

@Module({
  controllers: [PublicVenuesController],
  providers: [PublicVenuesService],
})
export class PublicVenuesModule {}
