import {
  Global,
  Inject,
  Module,
  type DynamicModule,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Env } from '../config/env.js';
import { S3Storage } from './s3.storage.js';
import { STORAGE, type StoragePort } from './storage.port.js';

// Global: venues (URLs, cleanup) and photos both need the storage.
@Global()
@Module({})
export class StorageModule implements OnModuleDestroy {
  constructor(@Inject(STORAGE) private readonly storage: StoragePort) {}

  static forRoot(env: Env): DynamicModule {
    return {
      module: StorageModule,
      providers: [{ provide: STORAGE, useFactory: () => new S3Storage(env) }],
      exports: [STORAGE],
    };
  }

  onModuleDestroy(): void {
    if (this.storage instanceof S3Storage) this.storage.destroy();
  }
}
