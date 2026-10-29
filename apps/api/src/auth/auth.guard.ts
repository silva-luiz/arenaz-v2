import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { APIError } from 'better-auth/api';
import type { FastifyRequest } from 'fastify';
import { AUTH, type Auth } from './auth.js';
import { toFetchHeaders } from './fetch-bridge.js';

const UNAUTHENTICATED = 'Faça login para continuar';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    let session: Awaited<ReturnType<Auth['api']['getSession']>>;
    try {
      session = await this.auth.api.getSession({
        headers: toFetchHeaders(request.headers),
      });
    } catch (error) {
      // A forged or garbage cookie is the client's problem; anything else
      // (database down...) must stay a 500 rather than log users out.
      if (error instanceof APIError) {
        throw new UnauthorizedException(UNAUTHENTICATED);
      }
      throw error;
    }
    if (!session) throw new UnauthorizedException(UNAUTHENTICATED);
    request.user = session.user;
    return true;
  }
}
