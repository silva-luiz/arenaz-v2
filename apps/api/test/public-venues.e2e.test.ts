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
import { DB, type DbHandle } from '../src/db/db.module.js';
import { STORAGE, type StoragePort } from '../src/storage/storage.port.js';
import { buildTestApp, signUpAs, uniqueToken } from './helpers.js';

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
async function seed(input: SeedVenue = {}) {
  const token = uniqueToken();
  const [row] = await handle.db
    .insert(venue)
    .values({
      ownerId,
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

  it('ordena por distância dentro do raio', async () => {
    // ~0.009 deg of latitude is 1 km, ~0.072 deg is 8 km.
    const center = { lat: -3.1, lng: -60.0 };
    const near = await seed({
      location: { lat: center.lat + 0.009, lng: center.lng },
    });
    const far = await seed({
      location: { lat: center.lat + 0.072, lng: center.lng },
    });
    const here = `lat=${String(center.lat)}&lng=${String(center.lng)}`;

    const tight = await search(`${here}&radiusKm=5`);
    expect(tight.items.map((item) => item.slug)).toEqual([near.slug]);
    expect(tight.items[0]?.distanceKm).toBeCloseTo(1, 1);

    const wide = await search(`${here}&radiusKm=10`);
    expect(wide.items.map((item) => item.slug)).toEqual([near.slug, far.slug]);
    expect(wide.items[1]?.distanceKm).toBeCloseTo(8, 0);
    for (const item of wide.items) {
      // One decimal at most.
      expect(Math.round((item.distanceKm ?? NaN) * 10) / 10).toBe(
        item.distanceKm,
      );
    }
  });

  it('raio usa 10 km por padrão e combina com esporte e texto', async () => {
    const center = { lat: -1.4, lng: -48.5 };
    const here = `lat=${String(center.lat)}&lng=${String(center.lng)}`;
    const token = uniqueToken();
    const padel = await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: center.lat + 0.045, lng: center.lng },
      fields: [{ sports: ['padel'] }],
    });
    await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: center.lat + 0.045, lng: center.lng },
      fields: [{ sports: ['futsal'] }],
    });
    await seed({
      neighborhood: `Raio ${token}`,
      location: { lat: center.lat + 0.2, lng: center.lng }, // ~22 km
      fields: [{ sports: ['padel'] }],
    });

    const body = await search(`${here}&sport=padel&${q(token)}`);
    expect(body.items.map((item) => item.slug)).toEqual([padel.slug]);
    expect(body.items[0]?.distanceKm).toBeCloseTo(5, 0);
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

  it('404 para rascunho e para slug inexistente', async () => {
    const draft = await seed({ status: 'draft' });
    for (const slug of [draft.slug, `nao-existe-${uniqueToken()}`]) {
      const res = await get(`/api/venues/${slug}`);
      expect(res.statusCode).toBe(404);
      expect(res.json<Problem>().detail).toBe('Espaço não encontrado');
    }
  });
});
