import { randomUUID } from 'node:crypto';
import {
  publicSearchResponseSchema,
  publicVenueSchema,
  type Problem,
  type Sport,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { STORAGE, type StoragePort } from '../src/storage/storage.port.js';
import { buildTestApp, signUpAs, testEnv, uniqueToken } from './helpers.js';

const { venue, venueHours, venuePhoto, field, priceRule } = schema;

let app: NestFastifyApplication;
let handle: DbHandle;
let storage: StoragePort;
let ownerId: string;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
  storage = app.get<StoragePort>(STORAGE);
  ({ userId: ownerId } = await signUpAs(app, 'Maria Silva Souza'));
});

afterAll(async () => {
  await app.close();
});

const get = (url: string): Promise<LightMyRequestResponse> =>
  app.inject({ method: 'GET', url });

interface SeedField {
  sports?: Sport[];
  price?: number;
  active?: boolean;
  name?: string;
  rules?: { price: number; weekdays?: number[]; label?: string }[];
}

interface SeedVenue {
  name?: string;
  neighborhood?: string;
  city?: string;
  status?: 'draft' | 'published';
  location?: { lat: number; lng: number };
  fields?: SeedField[];
  photoKeys?: { key: string; position: number }[];
  hours?: { weekday: number; openMinute: number; closeMinute: number }[];
  createdAt?: Date;
  description?: string | null;
}

/** Inserts straight into the database; a venue gets one active field by default. */
async function seed(input: SeedVenue = {}, owner: string = ownerId) {
  const token = uniqueToken();
  const [row] = await handle.db
    .insert(venue)
    .values({
      ownerId: owner,
      slug: `arena-${token}-${randomUUID().slice(0, 4)}`,
      name: input.name ?? `Arena ${token}`,
      description: input.description ?? null,
      phone: '(11) 98765-4321',
      cep: '01310100',
      street: 'Rua Sigilosa',
      number: '43210',
      complement: 'Sala 9',
      neighborhood: input.neighborhood ?? `Bairro ${token}`,
      city: input.city ?? 'Cidade Teste',
      state: 'SP',
      location: input.location ?? { lat: -23.55678, lng: -46.69123 },
      amenities: ['bar'],
      cancellationPolicy: 'flexivel',
      status: input.status ?? 'published',
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning({ id: venue.id, slug: venue.slug, name: venue.name });
  if (!row) throw new Error('seed falhou');
  for (const spec of input.fields ?? [{}]) {
    const [created] = await handle.db
      .insert(field)
      .values({
        venueId: row.id,
        name: spec.name ?? `Quadra ${uniqueToken()}`,
        sports: spec.sports ?? ['futsal'],
        surface: 'piso_rigido',
        minSlotMinutes: 60,
        basePriceCentsPerHour: spec.price ?? 8000,
        isActive: spec.active ?? true,
      })
      .returning({ id: field.id });
    if (!created) throw new Error('seed de quadra falhou');
    if (spec.rules?.length) {
      await handle.db.insert(priceRule).values(
        spec.rules.map((rule) => ({
          fieldId: created.id,
          weekdays: rule.weekdays ?? [6],
          startMinute: 600,
          endMinute: 720,
          priceCentsPerHour: rule.price,
          label: rule.label ?? null,
        })),
      );
    }
  }
  if (input.photoKeys?.length) {
    await handle.db.insert(venuePhoto).values(
      input.photoKeys.map((photo) => ({
        venueId: row.id,
        storageKey: `${photo.key}-${randomUUID()}`,
        position: photo.position,
      })),
    );
  }
  if (input.hours?.length) {
    await handle.db
      .insert(venueHours)
      .values(input.hours.map((hour) => ({ venueId: row.id, ...hour })));
  }
  return row;
}

const search = async (qs: string) => {
  const res = await get(`/api/venues?${qs}`);
  expect(res.statusCode).toBe(200);
  return publicSearchResponseSchema.parse(res.json());
};

const q = (term: string): string => `q=${encodeURIComponent(term)}`;

describe('GET /api/venues', () => {
  it('só lista publicados com quadra ativa e sem dado privado', async () => {
    const token = uniqueToken();
    const neighborhood = `Madalena ${token}`;
    const published = await seed({
      name: `Arena Pública ${token}`,
      neighborhood,
      fields: [{ sports: ['padel'], price: 9000 }],
    });
    await seed({ name: `Rascunho ${token}`, neighborhood, status: 'draft' });
    await seed({
      name: `Sem quadra ativa ${token}`,
      neighborhood,
      fields: [{ active: false }],
    });
    await seed({ name: `Sem quadra ${token}`, neighborhood, fields: [] });

    const res = await get(`/api/venues?${q(token)}`);
    expect(res.statusCode).toBe(200);
    const body = publicSearchResponseSchema.parse(res.json());
    expect(body.items.map((item) => item.name)).toEqual([published.name]);
    expect(body).toMatchObject({ page: 1, pageSize: 20, hasMore: false });
    expect(body.items[0]).toMatchObject({
      slug: published.slug,
      neighborhood,
      city: 'Cidade Teste',
      state: 'SP',
      coverUrl: null,
      sports: ['padel'],
      minPriceCentsPerHour: 9000,
      approxLocation: { lat: -23.56, lng: -46.69 },
      distanceKm: null,
    });
    const raw = res.body;
    for (const secret of [
      'phone',
      'street',
      'number',
      'cep',
      'complement',
      '98765',
      'Sigilosa',
      '43210',
      '01310100',
      '-23.5568',
      '-23.55678',
      '-46.69123',
    ]) {
      expect(raw).not.toContain(secret);
    }
    expect(Object.keys(body.items[0] ?? {}).sort()).toEqual(
      [
        'approxLocation',
        'city',
        'coverUrl',
        'distanceKm',
        'minPriceCentsPerHour',
        'name',
        'neighborhood',
        'slug',
        'sports',
        'state',
      ].sort(),
    );
  });

  it.each([
    'acao madalena',
    'AÇÃO MADALENA',
    ' acao   madalena ',
    'Ação Madalena',
  ])('busca sem acento e sem diferenciar caixa: %s', async (term) => {
    const token = uniqueToken();
    const found = await seed({ neighborhood: `Ação Madalena ${token}` });
    const body = await search(q(`${term} ${token}`.replace(/ +$/, '')));
    expect(body.items.map((item) => item.slug)).toEqual([found.slug]);
  });

  it('acha pela cidade, com consulta acentuada e dado sem acento', async () => {
    const token = uniqueToken();
    const found = await seed({ city: `Sao Jose ${token}` });
    const body = await search(q(`São José ${token}`));
    expect(body.items.map((item) => item.slug)).toEqual([found.slug]);
  });

  it('com q, ordena por nome e pagina de 20 em 20 com poucas consultas', async () => {
    const token = uniqueToken();
    const neighborhood = `Paginado ${token}`;
    const created = [];
    for (let index = 0; index < 25; index += 1) {
      created.push(
        await seed({
          name: `Arena ${String(index).padStart(2, '0')} ${token}`,
          neighborhood,
          fields: [{ sports: ['padel', 'futsal'] }],
          photoKeys: [{ key: 'pg', position: 0 }],
        }),
      );
    }
    const names = created.map((row) => row.name).sort();

    const spy = vi.spyOn(handle.pool, 'query');
    const first = await search(q(token));
    const queries = spy.mock.calls.length;
    spy.mockRestore();
    expect(queries).toBeGreaterThanOrEqual(1);
    expect(queries).toBeLessThanOrEqual(2);
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.items.map((item) => item.name)).toEqual(names.slice(0, 20));
    expect(first.items.every((item) => item.coverUrl !== null)).toBe(true);

    const second = await search(`${q(token)}&page=2`);
    expect(second).toMatchObject({ page: 2, hasMore: false });
    expect(second.items.map((item) => item.name)).toEqual(names.slice(20));
    const beyond = await search(`${q(token)}&page=3`);
    expect(beyond.items).toEqual([]);
    expect(beyond.hasMore).toBe(false);
  });

  it('sem filtro, lista os mais recentes primeiro', async () => {
    const older = await seed({ createdAt: new Date('2099-01-01T00:00:00Z') });
    const newer = await seed({ createdAt: new Date('2099-01-02T00:00:00Z') });
    const body = await search('');
    const slugs = body.items.map((item) => item.slug);
    expect(slugs.indexOf(newer.slug)).toBeGreaterThanOrEqual(0);
    expect(slugs.indexOf(newer.slug)).toBeLessThan(slugs.indexOf(older.slug));
  });

  it('ordena por distância (do ponto aproximado) dentro do raio', async () => {
    // The exact points are off the 0.01 degree grid on purpose: only the
    // snapped points (-3.09, -60.00) and (-3.03, -60.00) count.
    const near = await seed({ location: { lat: -3.0904, lng: -60.0003 } });
    const far = await seed({ location: { lat: -3.0298, lng: -59.9996 } });
    const here = 'lat=-3.1&lng=-60';

    const tight = await search(`${here}&radiusKm=5`);
    expect(tight.items.map((item) => item.slug)).toEqual([near.slug]);
    expect(tight.items[0]?.distanceKm).toBeCloseTo(1.1, 1);

    const wide = await search(`${here}&radiusKm=10`);
    expect(wide.items.map((item) => item.slug)).toEqual([near.slug, far.slug]);
    expect(wide.items[1]?.distanceKm).toBeCloseTo(7.7, 1);
    for (const item of wide.items) {
      // One decimal at most.
      expect(Math.round((item.distanceKm ?? NaN) * 10) / 10).toBe(
        item.distanceKm,
      );
    }
  });

  it('pontos exatos diferentes na mesma célula têm a mesma distância e inclusão para todo raio', async () => {
    // Both round to (-9.06, -40.01) but are ~0.5 km apart.
    const a = await seed({ location: { lat: -9.0612, lng: -40.0121 } });
    const b = await seed({ location: { lat: -9.0578, lng: -40.0089 } });
    const here = 'lat=-9&lng=-40';

    let seenIn = false;
    let seenOut = false;
    let sameDistance: number | null | undefined;
    for (let radius = 1; radius <= 50; radius += 1) {
      const body = await search(`${here}&radiusKm=${String(radius)}`);
      const inA = body.items.find((item) => item.slug === a.slug);
      const inB = body.items.find((item) => item.slug === b.slug);
      expect(Boolean(inA)).toBe(Boolean(inB));
      if (inA && inB) {
        seenIn = true;
        expect(inA.distanceKm).toBe(inB.distanceKm);
        expect(inA.approxLocation).toEqual({ lat: -9.06, lng: -40.01 });
        expect(inB.approxLocation).toEqual({ lat: -9.06, lng: -40.01 });
        sameDistance ??= inA.distanceKm;
        expect(inA.distanceKm).toBe(sameDistance);
      } else {
        seenOut = true;
      }
    }
    // The sweep crosses the boundary, so "same inclusion" was really tested.
    expect(seenIn).toBe(true);
    expect(seenOut).toBe(true);
  });

  it('raio usa 10 km por padrão e combina com esporte e texto', async () => {
    const here = 'lat=-1.4&lng=-48.5';
    const token = uniqueToken();
    // Snapped to (-1.35, -48.50): ~5.5 km; (-1.20, -48.50): ~22 km.
    const padel = await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: -1.3504, lng: -48.5002 },
      fields: [{ sports: ['padel'] }],
    });
    await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: -1.3504, lng: -48.5002 },
      fields: [{ sports: ['futsal'] }],
    });
    await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: -1.2, lng: -48.5 },
      fields: [{ sports: ['padel'] }],
    });

    const body = await search(`${here}&sport=padel&${q(token)}`);
    expect(body.items.map((item) => item.slug)).toEqual([padel.slug]);
    expect(body.items[0]?.distanceKm).toBeCloseTo(5.5, 1);
  });

  it('minPrice e esportes ignoram quadra inativa e faixa de preço', async () => {
    const token = uniqueToken();
    const target = await seed({
      neighborhood: `Preço ${token}`,
      fields: [
        { sports: ['tenis'], price: 5000, active: false },
        { sports: ['padel', 'futsal'], price: 9000, rules: [{ price: 1000 }] },
        { sports: ['futsal', 'beach_tennis'], price: 7000 },
      ],
    });
    const body = await search(q(token));
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      slug: target.slug,
      minPriceCentsPerHour: 7000,
      // Deduplicated, in the catalog's order, without the inactive field's.
      sports: ['futsal', 'beach_tennis', 'padel'],
    });
  });

  it('filtra por esporte só com quadra ativa', async () => {
    const token = uniqueToken();
    const neighborhood = `Esporte ${token}`;
    const ok = await seed({
      neighborhood,
      fields: [{ sports: ['padel'] }, { sports: ['tenis'], active: false }],
    });
    await seed({
      neighborhood,
      fields: [{ sports: ['tenis'], active: false }],
    });
    await seed({ neighborhood, fields: [{ sports: ['futsal'] }] });

    const body = await search(`${q(token)}&sport=padel`);
    expect(body.items.map((item) => item.slug)).toEqual([ok.slug]);
    expect((await search(`${q(token)}&sport=tenis`)).items).toEqual([]);
  });

  it('a capa é a foto da posição 0', async () => {
    const token = uniqueToken();
    const target = await seed({
      neighborhood: `Capa ${token}`,
      photoKeys: [
        { key: `capa-${token}-b`, position: 1 },
        { key: `capa-${token}-a`, position: 0 },
      ],
    });
    const [cover] = await handle.db
      .select({ key: venuePhoto.storageKey })
      .from(venuePhoto)
      .where(
        and(eq(venuePhoto.venueId, target.id), eq(venuePhoto.position, 0)),
      );
    const body = await search(q(token));
    expect(body.items[0]?.coverUrl).toBe(
      storage.publicUrl(cover?.key ?? 'missing'),
    );
  });

  it('termos com %, _ e \\ são literais', async () => {
    const token = uniqueToken();
    const plain = await seed({ neighborhood: `Aaa${token}` });
    const percent = await seed({ neighborhood: `Cem%% ${token}` });
    const underscore = await seed({ neighborhood: `Sub_ ${token}` });
    const backslash = await seed({ neighborhood: `Rua\\Sul ${token}` });

    // `_` as a wildcard would match "Aaa<token>"; `%%` would match anything.
    expect((await search(q(`A_a${token}`))).items).toEqual([]);
    const everything = await search(q('%%'));
    expect(everything.items.map((item) => item.slug)).not.toContain(plain.slug);
    expect(
      (await search(q(`Cem%% ${token}`))).items.map((item) => item.slug),
    ).toEqual([percent.slug]);
    expect((await search(q(`Cem%X ${token}`))).items).toEqual([]);
    expect(
      (await search(q(`Sub_ ${token}`))).items.map((item) => item.slug),
    ).toEqual([underscore.slug]);
    expect((await search(q(`SubX ${token}`))).items).toEqual([]);
    expect(
      (await search(q(`Rua\\Sul ${token}`))).items.map((item) => item.slug),
    ).toEqual([backslash.slug]);
    expect((await search(q(`Rua\\ ${token}`))).items).toEqual([]);
    expect((await search(q(`Rua\\\\Sul ${token}`))).items).toEqual([]);
  });

  it.each([
    ['radiusKm=10000'],
    ['lat=999&lng=0'],
    ['lat=-23.5'],
    ['lng=-46.6'],
    ['page=-1'],
    ['page=51'],
    ['sport=xyz'],
    ['q=' + 'a'.repeat(500)],
    ['q=a'],
    ['lat=abc&lng=-46'],
    ['radiusKm=5.5'],
    ['q=ab%00'],
    ['q=ab%0Acd'],
  ])('parâmetro inválido %s → 422', async (qs) => {
    const res = await get(`/api/venues?${qs}`);
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json<Problem>();
    expect(Object.keys(problem.errors ?? {}).length).toBeGreaterThan(0);
  });

  it('lat sem lng: o erro fica em lng', async () => {
    const res = await get('/api/venues?lat=-23.5');
    expect(res.json<Problem>().errors).toEqual({
      lng: ['Informe a latitude e a longitude juntas'],
    });
  });

  it('ignora parâmetros desconhecidos e não exige login', async () => {
    const res = await get(`/api/venues?${q(uniqueToken())}&foo=bar`);
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /api/venues/:slug', () => {
  it('200 publicado, só quadras ativas, sem dado privado', async () => {
    const token = uniqueToken();
    const target = await seed({
      name: `Arena Detalhe ${token}`,
      description: 'Uma ótima arena',
      photoKeys: [
        { key: `det-${token}-b`, position: 1 },
        { key: `det-${token}-a`, position: 0 },
      ],
      hours: [
        { weekday: 5, openMinute: 480, closeMinute: 1320 },
        { weekday: 1, openMinute: 540, closeMinute: 1200 },
      ],
      fields: [
        {
          name: 'Quadra Ativa',
          sports: ['padel', 'futsal'],
          price: 9000,
          rules: [{ price: 12000, label: 'Fim de semana' }],
        },
        { name: 'Quadra Inativa', active: false, price: 100 },
      ],
    });

    const res = await get(`/api/venues/${target.slug}`);
    expect(res.statusCode).toBe(200);
    const body = publicVenueSchema.parse(res.json());
    expect(body).toMatchObject({
      slug: target.slug,
      name: `Arena Detalhe ${token}`,
      description: 'Uma ótima arena',
      city: 'Cidade Teste',
      state: 'SP',
      approxLocation: { lat: -23.56, lng: -46.69 },
      amenities: ['bar'],
      cancellationPolicy: 'flexivel',
      host: { firstName: 'Maria' },
    });
    expect(body.hours.map((hour) => hour.weekday)).toEqual([1, 5]);
    expect(body.photos.map((photo) => photo.position)).toEqual([0, 1]);
    expect(body.photos[0]?.url).toContain(`det-${token}-a`);
    expect(body.fields).toHaveLength(1);
    expect(body.fields[0]).toMatchObject({
      name: 'Quadra Ativa',
      sports: ['padel', 'futsal'],
      basePriceCentsPerHour: 9000,
      priceRules: [
        {
          weekdays: [6],
          startMinute: 600,
          endMinute: 720,
          priceCentsPerHour: 12000,
          label: 'Fim de semana',
        },
      ],
    });
    expect(body.fields[0]?.priceRules[0]).not.toHaveProperty('id');

    for (const secret of [
      '98765',
      'Sigilosa',
      '43210',
      '01310100',
      'Sala 9',
      '-23.55678',
      '-46.69123',
      '-23.5568',
      ownerId,
      'Souza',
      'ownerId',
      'email',
      'phone',
      'street',
      'cep',
      'complement',
    ]) {
      expect(res.body).not.toContain(secret);
    }
  });

  it('404 para rascunho, slug inexistente e slug fora do padrão', async () => {
    const draft = await seed({ status: 'draft' });
    for (const slug of [
      draft.slug,
      `nao-existe-${uniqueToken()}`,
      '%00',
      'ARENA',
      'a'.repeat(81),
      'arena%20x',
    ]) {
      const res = await get(`/api/venues/${slug}`);
      expect(res.statusCode).toBe(404);
      expect(res.json<Problem>().detail).toBe('Espaço não encontrado');
    }
  });
});

describe('host.firstName', () => {
  it.each([
    ['Maria Silva', 'Maria'],
    ['  joão   da Silva ', 'joão'],
    ['maria@mail.com', 'Dono'],
    ['Maria2 Silva', 'Dono'],
    ['11999990000', 'Dono'],
  ])('%j vira %j', async (fullName, expected) => {
    const { userId } = await signUpAs(app, fullName);
    const row = await seed({}, userId);
    const res = await get(`/api/venues/${row.slug}`);
    expect(res.statusCode).toBe(200);
    expect(publicVenueSchema.parse(res.json()).host.firstName).toBe(expected);
  });
});

describe('limite de requisições e token interno', () => {
  const TOKEN = 'i'.repeat(40);

  async function limitedApp(): Promise<NestFastifyApplication> {
    // The limiter is off in NODE_ENV=test, so run this app as development.
    const limited = await createApp({
      ...testEnv,
      NODE_ENV: 'development',
      INTERNAL_API_TOKEN: TOKEN,
    });
    await limited.init();
    await limited.getHttpAdapter().getInstance().ready();
    return limited;
  }

  const statuses = async (
    limited: NestFastifyApplication,
    headers: Record<string, string>,
    count: number,
  ): Promise<number[]> => {
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const res = await limited.inject({
        method: 'GET',
        url: `/api/venues?${q(`zz${uniqueToken()}`)}`,
        headers,
      });
      out.push(res.statusCode);
    }
    return out;
  };

  it('60 por minuto por IP; o token interno isenta; token errado não', async () => {
    const limited = await limitedApp();
    try {
      const anonymous = await statuses(limited, {}, 61);
      expect(anonymous.slice(0, 60).every((code) => code === 200)).toBe(true);
      expect(anonymous[60]).toBe(429);

      // Same IP (already limited): the right token still goes through...
      const internal = await statuses(
        limited,
        { 'x-internal-token': TOKEN },
        65,
      );
      expect(internal.every((code) => code === 200)).toBe(true);

      // ...a wrong one (same length or not) does not.
      for (const wrong of ['x'.repeat(40), 'curto', `${TOKEN}x`]) {
        expect(
          (await statuses(limited, { 'x-internal-token': wrong }, 1))[0],
        ).toBe(429);
      }
    } finally {
      await limited.close();
    }
  });

  it('sem INTERNAL_API_TOKEN configurado, o cabeçalho não isenta ninguém', async () => {
    const limited = await createApp({
      ...testEnv,
      NODE_ENV: 'development',
    });
    await limited.init();
    await limited.getHttpAdapter().getInstance().ready();
    try {
      const codes = await statuses(limited, { 'x-internal-token': '' }, 61);
      expect(codes[60]).toBe(429);
    } finally {
      await limited.close();
    }
  });
});
