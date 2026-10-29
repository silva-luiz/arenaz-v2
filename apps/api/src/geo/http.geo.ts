import {
  cepLookupResponseSchema,
  locationSchema,
  type CepLookupResponse,
  type LatLng,
} from '@arenaz/contracts';
import { z } from 'zod';
import { GeoUnavailableError, type GeoPort } from './geo.port.js';

const VIACEP_URL = 'https://viacep.com.br/ws';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ArenaZ/0.1 (contato via repositório)';

/** Per upstream call. */
const TIMEOUT_MS = 3000;
/** Nominatim's usage policy: at most one request per second. */
const NOMINATIM_MIN_GAP_MS = 1000;
const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const viaCepFound = z.object({
  logradouro: z.string(),
  bairro: z.string(),
  localidade: z.string(),
  uf: z.string(),
});
// ViaCEP has answered both `true` and `"true"` for unknown CEPs.
const viaCepNotFound = z.object({
  erro: z.union([z.literal(true), z.literal('true')]),
});
const nominatimHits = z.array(
  z.object({ lat: z.string().min(1), lon: z.string().min(1) }),
);
const addressSchema = cepLookupResponseSchema.omit({ location: true });

type Address = z.infer<typeof addressSchema>;

export interface HttpGeoOptions {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface CacheEntry {
  value: CepLookupResponse | null;
  expiresAt: number;
}

interface Geocoded {
  location: LatLng | null;
  /** False when Nominatim failed (timeout, 5xx...): that is not cached. */
  definitive: boolean;
}

function copy(value: CepLookupResponse | null): CepLookupResponse | null {
  return (
    value && { ...value, location: value.location && { ...value.location } }
  );
}

function formatCep(digits: string): string {
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `GeoPort` on ViaCEP (address) + Nominatim (map pin), with 3 s timeouts, an
 * in-memory LRU (1000 entries, 24 h) and a 1 req/s throttle on Nominatim.
 *
 * Cached: found addresses and "not found". Never cached: ViaCEP failures
 * (they throw) and addresses whose geocoding failed transiently.
 */
export class HttpGeo implements GeoPort {
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Insertion order is recency order (least recently used first). */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<
    string,
    Promise<CepLookupResponse | null>
  >();
  /** Serializes Nominatim calls; never rejects. */
  private nominatimQueue: Promise<unknown> = Promise.resolve();
  private lastNominatimAt = Number.NEGATIVE_INFINITY;

  constructor(options: HttpGeoOptions = {}) {
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.now = options.now ?? (() => Date.now());
    this.sleep =
      options.sleep ??
      ((ms) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        }));
  }

  async lookupCep(cep: string): Promise<CepLookupResponse | null> {
    // The CEP goes into a URL: anything but 8 digits never reaches the network.
    if (!/^\d{8}$/.test(cep)) return null;

    const cached = this.cacheGet(cep);
    if (cached !== undefined) return copy(cached.value);

    let pending = this.inflight.get(cep);
    if (pending === undefined) {
      pending = this.resolve(cep).finally(() => {
        this.inflight.delete(cep);
      });
      this.inflight.set(cep, pending);
    }
    return copy(await pending);
  }

  private async resolve(cep: string): Promise<CepLookupResponse | null> {
    const address = await this.viaCep(cep);
    if (address === null) {
      this.cacheSet(cep, null);
      return null;
    }
    const { location, definitive } = await this.geocode(cep, address);
    const result: CepLookupResponse = { ...address, location };
    if (definitive) this.cacheSet(cep, result);
    return result;
  }

  private cacheGet(cep: string): CacheEntry | undefined {
    const entry = this.cache.get(cep);
    if (entry === undefined) return undefined;
    this.cache.delete(cep);
    if (entry.expiresAt <= this.now()) return undefined;
    this.cache.set(cep, entry); // most recently used goes last
    return entry;
  }

  private cacheSet(cep: string, value: CepLookupResponse | null): void {
    this.cache.delete(cep);
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(cep, {
      value: copy(value),
      expiresAt: this.now() + CACHE_TTL_MS,
    });
  }

  /** The address without a pin; `null` when the CEP does not exist. */
  private async viaCep(cep: string): Promise<Address | null> {
    let body: unknown;
    try {
      const res = await this.fetchFn(`${VIACEP_URL}/${cep}/json/`, {
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // A real "not found" is `erro: true` (HTTP 200); 404 is not that.
      if (res.status === 400) return null;
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      body = await res.json();
    } catch (error) {
      throw new GeoUnavailableError(`ViaCEP indisponível: ${reason(error)}`, {
        cause: error,
      });
    }

    if (viaCepNotFound.safeParse(body).success) return null;
    const found = viaCepFound.safeParse(body);
    const address = addressSchema.safeParse(
      found.success
        ? {
            cep,
            street: found.data.logradouro,
            neighborhood: found.data.bairro,
            city: found.data.localidade,
            state: found.data.uf,
          }
        : undefined,
    );
    if (!address.success) {
      throw new GeoUnavailableError('ViaCEP respondeu em formato inesperado');
    }
    return address.data;
  }

  private async geocode(cep: string, address: Address): Promise<Geocoded> {
    const base = { format: 'jsonv2', countrycodes: 'br', limit: '1' };
    const postalcode = formatCep(cep);
    const attempts: Record<string, string>[] = [
      {
        ...base,
        ...(address.street === '' ? {} : { street: address.street }),
        city: address.city,
        state: address.state,
        postalcode,
      },
      // The street/city match can be too strict; the postcode alone is not.
      { ...base, postalcode },
    ];
    try {
      for (const params of attempts) {
        const hit = await this.nominatim(params);
        if (hit !== null) return { location: hit, definitive: true };
      }
      return { location: null, definitive: true };
    } catch {
      // Transient: the address is still useful without a pin.
      return { location: null, definitive: false };
    }
  }

  /** The first hit if it is inside Brazil, else `null`. Throws on failure. */
  private async nominatim(
    params: Record<string, string>,
  ): Promise<LatLng | null> {
    const url = `${NOMINATIM_URL}?${new URLSearchParams(params).toString()}`;
    const body = await this.throttled(async () => {
      const res = await this.fetchFn(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return res.json();
    });

    const hits = nominatimHits.safeParse(body);
    const first = hits.success ? hits.data[0] : undefined;
    if (first === undefined) return null;
    const location = locationSchema.safeParse({
      lat: Number(first.lat),
      lng: Number(first.lon),
    });
    return location.success ? location.data : null;
  }

  /** Runs `task` after earlier Nominatim calls, >= 1 s after the last start. */
  private throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = this.nominatimQueue.then(async () => {
      const wait = this.lastNominatimAt + NOMINATIM_MIN_GAP_MS - this.now();
      if (wait > 0) await this.sleep(wait);
      this.lastNominatimAt = this.now();
      return task();
    });
    this.nominatimQueue = run.catch(() => undefined);
    return run;
  }
}
