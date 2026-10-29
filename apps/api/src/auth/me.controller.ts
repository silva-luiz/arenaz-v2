import { meResponseSchema, type MeResponse } from '@arenaz/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from './auth.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  @Get()
  me(@CurrentUser() user: AuthUser): MeResponse {
    return meResponseSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });
  }
}
