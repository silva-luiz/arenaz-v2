import { Module, type DynamicModule } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.js';
import { DB, type DbHandle } from '../db/db.module.js';
import { AUTH, createAuth, type Auth } from './auth.js';
import { AuthGuard } from './auth.guard.js';
import { MeController } from './me.controller.js';

@Module({})
export class AuthModule {
  static forRoot(env: Env, logger: FastifyBaseLogger): DynamicModule {
    return {
      module: AuthModule,
      controllers: [MeController],
      providers: [
        {
          provide: AUTH,
          inject: [DB],
          useFactory: (handle: DbHandle): Auth =>
            createAuth(env, handle.db, logger),
        },
        AuthGuard,
      ],
      exports: [AUTH],
    };
  }
}
