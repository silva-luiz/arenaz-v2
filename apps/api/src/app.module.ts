import { Module, type DynamicModule } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';
import { AuthModule } from './auth/auth.module.js';
import type { Env } from './config/env.js';
import { DbModule, type DbModuleOptions } from './db/db.module.js';
import { FieldsModule } from './fields/fields.module.js';
import { GeoModule } from './geo/geo.module.js';
import { HealthModule } from './health/health.module.js';
import { PhotosModule } from './photos/photos.module.js';
import { PublicVenuesModule } from './public/public-venues.module.js';
import { StorageModule } from './storage/storage.module.js';
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
        StorageModule.forRoot(env),
        GeoModule.forRoot(env),
        HealthModule,
        VenuesModule,
        FieldsModule,
        PhotosModule,
        PublicVenuesModule,
      ],
    };
  }
}
