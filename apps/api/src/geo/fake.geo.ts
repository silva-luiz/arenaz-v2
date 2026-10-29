import type { CepLookupResponse } from '@arenaz/contracts';
import type { GeoPort } from './geo.port.js';

const TABLE: Record<string, CepLookupResponse> = {
  '01310100': {
    cep: '01310100',
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    location: { lat: -23.5614, lng: -46.6559 },
  },
  '05435000': {
    cep: '05435000',
    street: 'Rua Harmonia',
    neighborhood: 'Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    location: { lat: -23.5568, lng: -46.6916 },
  },
};

/** `GeoPort` with a fixed table, for tests and e2e (never in production). */
export class FakeGeo implements GeoPort {
  lookupCep(cep: string): Promise<CepLookupResponse | null> {
    const found = Object.hasOwn(TABLE, cep) ? TABLE[cep] : undefined;
    return Promise.resolve(
      found === undefined
        ? null
        : { ...found, location: found.location && { ...found.location } },
    );
  }
}
