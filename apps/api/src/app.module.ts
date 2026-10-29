import { Module, type DynamicModule } from '@nestjs/common';
import { DbModule, type DbModuleOptions } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';

@Module({})
export class AppModule {
  static register(db: DbModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [DbModule.forRoot(db), HealthModule],
    };
  }
}
