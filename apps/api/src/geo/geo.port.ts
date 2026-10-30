import type { CepLookupResponse } from '@arenaz/contracts';

/** DI token of the CEP lookup (`GeoPort`). */
export const GEO = Symbol('GEO');

/**
 * The CEP provider could not answer (network error, timeout, 5xx, garbage).
 * Distinct from "the CEP does not exist", which is a plain `null`.
 */
export class GeoUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'GeoUnavailableError';
  }
}

/** Address + map pin for a Brazilian postal code. */
export interface GeoPort {
  /**
   * `cep` is the 8 digits. Resolves `null` when the CEP does not exist and
   * `location: null` when the address is known but could not be geocoded.
   * Throws `GeoUnavailableError` when the address provider is down.
   */
  lookupCep(cep: string): Promise<CepLookupResponse | null>;
}
