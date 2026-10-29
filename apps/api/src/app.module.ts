import { Module, type DynamicModule } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';
import { AuthModule } from './auth/auth.module.js';
import type { Env } from './config/env.js';
import { DbModule, type DbModuleOptions } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';
import { VenuesModule } from './venues/venues.module.js';

@Module({})
export class AppModule {
  static register(
    env: Env,
    db: DbModuleOptions,
    logger: FastifyBaseLogger,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DbModule.forRoot(db),
        AuthModule.forRoot(env, logger),
        HealthModule,
        VenuesModule,
      ],
    };
  }
}
