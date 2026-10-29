import { Module } from '@nestjs/common';
import { FieldsController } from './fields.controller.js';
import { FieldsService } from './fields.service.js';

@Module({
  controllers: [FieldsController],
  providers: [FieldsService],
})
export class FieldsModule {}
