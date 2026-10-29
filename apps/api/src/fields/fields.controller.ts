import {
  blockInputSchema,
  fieldInputSchema,
  fieldUpdateSchema,
  priceRulesInputSchema,
  type Block,
  type BlockInput,
  type FieldInput,
  type FieldResponse,
  type FieldUpdate,
  type PriceRule,
  type PriceRuleInput,
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
import { FieldsService } from './fields.service.js';

// Bodies are validated by the pipes before a handler runs, so a request with
// an invalid body gets the same 422 whoever owns the field (no existence leak).
@Controller('owner')
@UseGuards(AuthGuard)
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Post('venues/:venueId/fields')
  create(
    @CurrentUser() user: AuthUser,
    @Param('venueId') venueId: string,
    @Body(new ZodPipe(fieldInputSchema)) input: FieldInput,
  ): Promise<FieldResponse> {
    return this.fields.create(user.id, venueId, input);
  }

  @Get('fields/:id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<FieldResponse> {
    return this.fields.get(user.id, id);
  }

  @Patch('fields/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(fieldUpdateSchema)) input: FieldUpdate,
  ): Promise<FieldResponse> {
    return this.fields.update(user.id, id, input);
  }

  @Delete('fields/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.fields.remove(user.id, id);
  }

  @Put('fields/:id/price-rules')
  replacePriceRules(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(priceRulesInputSchema)) rules: PriceRuleInput[],
  ): Promise<PriceRule[]> {
    return this.fields.replacePriceRules(user.id, id, rules);
  }

  @Post('fields/:id/blocks')
  addBlock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(blockInputSchema)) input: BlockInput,
  ): Promise<Block> {
    return this.fields.addBlock(user.id, id, input);
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBlock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.fields.removeBlock(user.id, id);
  }
}
