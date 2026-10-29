import {
  Global,
  Inject,
  Module,
  type DynamicModule,
  type OnModuleDestroy,
} from '@nestjs/common';
import { createDb } from '@arenaz/db';

export const DB = Symbol('DB');

/** The `{ db, pool }` pair provided under the `DB` token. */
export type DbHandle = ReturnType<typeof createDb>;

export interface DbModuleOptions {
  url: string;
  onError: (error: Error) => void;
}

@Global()
@Module({})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  static forRoot(options: DbModuleOptions): DynamicModule {
    return {
      module: DbModule,
      providers: [
        {
          provide: DB,
          // The pool connects lazily, so an unreachable database does not
          // stop the app from booting (health then reports it as down).
          useFactory: (): DbHandle =>
            createDb(options.url, { onError: options.onError }),
        },
      ],
      exports: [DB],
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.handle.pool.end();
  }
}
