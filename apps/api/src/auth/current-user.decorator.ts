import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `AuthGuard` once the session cookie has been verified. */
    user?: AuthUser;
  }
}

/** The authenticated user; only meaningful on routes behind `AuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<FastifyRequest>().user,
);
