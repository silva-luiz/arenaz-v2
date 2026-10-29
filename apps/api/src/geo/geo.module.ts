import { Module, type DynamicModule } from '@nestjs/common';
import type { Env } from '../config/env.js';
import { FakeGeo } from './fake.geo.js';
import { GeoController } from './geo.controller.js';
import { GEO } from './geo.port.js';
import { HttpGeo } from './http.geo.js';

@Module({})
export class GeoModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: GeoModule,
      controllers: [GeoController],
      providers: [
        {
          provide: GEO,
          useFactory: () =>
            env.GEO_PROVIDER === 'fake' ? new FakeGeo() : new HttpGeo(),
        },
      ],
      exports: [GEO],
    };
  }
}
