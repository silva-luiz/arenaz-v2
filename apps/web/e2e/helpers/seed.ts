import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, APIResponse } from '@playwright/test';

const PASSWORD = 'Senha@123';
const PHOTO = fileURLToPath(new URL('../fixtures/quadra.png', import.meta.url));

/**
 * Deliberately distinctive private data. The public page must never show any
 * of it, so the negative assertions can search for these exact strings.
 */
export const PRIVATE = {
  street: 'Rua Sigilosa dos Testes',
  /** Alphanumeric, so it cannot collide with a timestamp, hash or price. */
  number: '7391-B',
  phone: '(11) 93456-7821',
  phoneDigits: '934567821',
  cep: '05435000',
  /** Exact coordinates; the public page only gets them rounded (2 decimals). */
  lat: -23.55617,
  lng: -46.69123,
} as const;

let sequence = 0;
/** Unique per call, so tests (and reruns against the same DB) never collide. */
export function unique(): string {
  sequence += 1;
  return `${String(Date.now())}${String(sequence)}`;
}

export interface SeededVenue {
  id: string;
  slug: string;
  name: string;
  /**
   * Unique per venue ("Vila Madalena Seed <id>"). The public search matches
   * city and neighborhood, so searching for it finds exactly this venue,
   * whatever older runs left in the database, and gives every attempt its own
   * 60 s data-cache key (a CI retry never reuses a stale listing).
   */
  neighborhood: string;
}

async function expectOk(
  response: APIResponse,
  what: string,
  status = 200,
): Promise<unknown> {
  if (response.status() !== status) {
    throw new Error(
      `${what} falhou (${String(response.status())}): ${await response.text()}`,
    );
  }
  return response.status() === 204 ? undefined : response.json();
}

/**
 * Seeds data through the HTTP API, much faster than driving the owner UI. The
 * context must be a fresh one (`playwright.request.newContext({ baseURL })`):
 * it keeps the owner's session cookie. Requests go to the web origin, so
 * `/api/*` crosses the Next rewrite exactly like in the browser, and the
 * `Origin` header is the one the API expects for auth POSTs.
 */
export class OwnerApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly origin: string,
  ) {}

  private headers() {
    return { origin: this.origin };
  }

  async signUp(name: string): Promise<void> {
    const response = await this.request.post('/api/auth/sign-up/email', {
      headers: this.headers(),
      data: {
        name,
        email: `dono+${unique()}@mail.com`,
        password: PASSWORD,
      },
    });
    await expectOk(response, 'cadastro');
  }

  /** A draft venue in Vila Madalena (CEP 05435000 in the fake geo). */
  async createDraftVenue(name: string): Promise<SeededVenue> {
    const neighborhood = `Vila Madalena Seed ${unique()}`;
    const response = await this.request.post('/api/owner/venues', {
      headers: this.headers(),
      data: {
        name,
        description: 'Espaço criado pelos testes e2e.',
        phone: PRIVATE.phone,
        address: {
          cep: PRIVATE.cep,
          street: PRIVATE.street,
          number: PRIVATE.number,
          neighborhood,
          city: 'São Paulo',
          state: 'SP',
        },
        location: { lat: PRIVATE.lat, lng: PRIVATE.lng },
        amenities: ['vestiario', 'estacionamento'],
        cancellationPolicy: 'moderada',
      },
    });
    const body = (await expectOk(response, 'criar espaço', 201)) as {
      id: string;
      slug: string;
    };
    return { id: body.id, slug: body.slug, name, neighborhood };
  }

  async setHours(venueId: string): Promise<void> {
    const hours = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      openMinute: 8 * 60,
      closeMinute: 23 * 60,
    }));
    const response = await this.request.put(
      `/api/owner/venues/${venueId}/hours`,
      { headers: this.headers(), data: hours },
    );
    await expectOk(response, 'horário');
  }

  async createSocietyCourt(venueId: string): Promise<void> {
    const response = await this.request.post(
      `/api/owner/venues/${venueId}/fields`,
      {
        headers: this.headers(),
        data: {
          name: 'Society 1',
          sports: ['futebol_society'],
          surface: 'grama_sintetica',
          format: '7x7',
          minSlotMinutes: 60,
          basePriceCentsPerHour: 18000,
          isActive: true,
        },
      },
    );
    await expectOk(response, 'criar quadra', 201);
  }

  /** Presigned flow: upload-url, POST to object storage, confirm. */
  async uploadPhoto(venueId: string): Promise<void> {
    const file = await readFile(PHOTO);
    const base = `/api/owner/venues/${venueId}/photos`;

    const presigned = (await expectOk(
      await this.request.post(`${base}/upload-url`, {
        headers: this.headers(),
        data: { contentType: 'image/png', size: file.byteLength },
      }),
      'url de upload',
      201,
    )) as { url: string; fields: Record<string, string>; key: string };

    // The policy fields go first and `file` last, as S3 requires.
    const stored = await this.request.post(presigned.url, {
      multipart: {
        ...presigned.fields,
        file: { name: 'quadra.png', mimeType: 'image/png', buffer: file },
      },
    });
    if (!stored.ok()) {
      throw new Error(
        `envio da foto falhou (${String(stored.status())}): ${await stored.text()}`,
      );
    }

    await expectOk(
      await this.request.post(base, {
        headers: this.headers(),
        data: { key: presigned.key },
      }),
      'confirmar foto',
      201,
    );
  }

  async publish(venueId: string): Promise<void> {
    const response = await this.request.post(
      `/api/owner/venues/${venueId}/publish`,
      { headers: this.headers() },
    );
    await expectOk(response, 'publicar');
  }
}

/**
 * A complete published venue (hours, one active Society court, one photo),
 * owned by a brand-new owner.
 */
export async function seedPublishedVenue(api: OwnerApi): Promise<SeededVenue> {
  await api.signUp('Dono Seed');
  const venue = await api.createDraftVenue(`Arena Seed ${unique()}`);
  await api.setHours(venue.id);
  await api.createSocietyCourt(venue.id);
  await api.uploadPhoto(venue.id);
  await api.publish(venue.id);
  return venue;
}

/** A venue that stays a draft (no hours, courts or photos needed). */
export async function seedDraftVenue(api: OwnerApi): Promise<SeededVenue> {
  await api.signUp('Dono Rascunho');
  return api.createDraftVenue(`Rascunho Seed ${unique()}`);
}
