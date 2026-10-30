import { randomUUID } from 'node:crypto';
import {
  publicSearchResponseSchema,
  publicVenueSchema,
  type Amenity,
  type Problem,
  type Sport,
} from '@arenaz/contracts';
import { localMinuteOf } from '@arenaz/booking-core';
import { schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.factory.js';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { loadFreeTimes, loadNextFreeTimes } from '../src/public/next-free.js';
import { STORAGE, type StoragePort } from '../src/storage/storage.port.js';
import { SP, at, insertBooking, spDate } from './booking-seed.js';
import { buildTestApp, signUpAs, testEnv, uniqueToken } from './helpers.js';

const { venue, venueHours, venuePhoto, field, priceRule, availabilityBlock } =
  schema;

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
  photoKeys?: { key: string; position: number; variantWidths?: number[] }[];
  hours?: { weekday: number; openMinute: number; closeMinute: number }[];
  createdAt?: Date;
  description?: string | null;
  timezone?: string;
  amenities?: Amenity[];
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
      amenities: input.amenities ?? ['bar'],
      cancellationPolicy: 'flexivel',
      timezone: input.timezone ?? 'America/Sao_Paulo',
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
        variantWidths: photo.variantWidths ?? null,
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
      // No opening hours: nothing is free today.
      nextFreeTime: null,
      freeTimes: [],
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
        'coverSrcSet',
        'coverUrl',
        'distanceKm',
        'freeTimes',
        'minPriceCentsPerHour',
        'nextFreeTime',
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

  it('minPrice conta faixa mais barata de quadra ativa, mas não quadra inativa nem faixa mais cara', async () => {
    const token = uniqueToken();
    const target = await seed({
      neighborhood: `Preço ${token}`,
      fields: [
        // Inactive: neither its base price nor its (cheaper) rule count.
        {
          sports: ['tenis'],
          price: 5000,
          active: false,
          rules: [{ price: 500 }],
        },
        // A cheaper rule lowers the minimum.
        { sports: ['padel', 'futsal'], price: 9000, rules: [{ price: 6000 }] },
        // A more expensive rule does not.
        {
          sports: ['futsal', 'beach_tennis'],
          price: 7000,
          rules: [{ price: 8000 }],
        },
      ],
    });
    const body = await search(q(token));
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      slug: target.slug,
      minPriceCentsPerHour: 6000,
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
    ['amenities=piscina'],
    ['amenities=coberta,piscina'],
    ['amenities='],
    ['maxPrice=0'],
    ['maxPrice=-1'],
    ['maxPrice=10001'],
    ['maxPrice=abc'],
    ['maxPrice='],
    ['q=ab%00'],
    ['q=ab%0Acd'],
  ])('parâmetro inválido %s → 422', async (qs) => {
    const res = await get(`/api/venues?${qs}`);
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json<Problem>();
    expect(Object.keys(problem.errors ?? {}).length).toBeGreaterThan(0);
  });

  it('a capa traz srcSet das variantes prontas, null enquanto pendentes', async () => {
    const token = uniqueToken();
    await seed({
      neighborhood: `Variantes ${token} A`,
      photoKeys: [
        { key: `var-${token}-a`, position: 0, variantWidths: [400, 800, 1600] },
      ],
    });
    await seed({
      neighborhood: `Variantes ${token} B`,
      photoKeys: [{ key: `var-${token}-b`, position: 0 }],
    });
    const body = await search(q(`Variantes ${token}`));
    const [ready, pending] = [...body.items].sort((a, b) =>
      a.neighborhood.localeCompare(b.neighborhood),
    );
    const cover = ready?.coverUrl ?? '';
    expect(cover).toContain(`${testEnv.S3_PUBLIC_URL}/var-${token}-a-`);
    expect(ready?.coverSrcSet).toBe(
      `${cover}.w400.webp 400w, ${cover}.w800.webp 800w, ${cover}.w1600.webp 1600w`,
    );
    expect(pending?.coverUrl).toContain(`var-${token}-b`);
    expect(pending?.coverSrcSet).toBeNull();
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

describe('GET /api/venues: filtros de comodidade e preço', () => {
  it('amenities devolve só quem tem todas (AND)', async () => {
    const token = uniqueToken();
    const neighborhood = `Comodidades ${token}`;
    const both = await seed({
      neighborhood,
      amenities: ['coberta', 'vestiario', 'bar'],
    });
    await seed({ neighborhood, amenities: ['coberta', 'bar'] });
    await seed({ neighborhood, amenities: ['vestiario'] });
    await seed({ neighborhood, amenities: [] });
    const exact = await seed({
      neighborhood,
      amenities: ['vestiario', 'coberta'],
    });

    const slugs = async (qs: string) =>
      (await search(`${q(token)}&${qs}`)).items.map((item) => item.slug).sort();
    expect(await slugs('amenities=coberta,vestiario')).toEqual(
      [both.slug, exact.slug].sort(),
    );
    // Order, spaces and repeats in the list do not matter.
    expect(await slugs('amenities=vestiario,%20coberta,coberta')).toEqual(
      [both.slug, exact.slug].sort(),
    );
    expect(await slugs('amenities=coberta,vestiario,bar')).toEqual([both.slug]);
    expect(await slugs('amenities=wifi')).toEqual([]);
    expect(await slugs('page=1')).toHaveLength(5);
  });

  it('amenities inválido responde 422 com "Comodidade inválida"', async () => {
    const res = await get('/api/venues?amenities=coberta,piscina');
    expect(res.statusCode).toBe(422);
    expect(res.json<Problem>().errors).toEqual({
      amenities: ['Comodidade inválida'],
    });
  });

  it('maxPrice (reais) mantém quem tem a partir de <= maxPrice, faixa mais barata incluída', async () => {
    const token = uniqueToken();
    const neighborhood = `Preço máx ${token}`;
    const cheap = await seed({ neighborhood, fields: [{ price: 9000 }] });
    const edge = await seed({ neighborhood, fields: [{ price: 15000 }] });
    const viaRule = await seed({
      neighborhood,
      fields: [{ price: 20000, rules: [{ price: 12000 }] }],
    });
    await seed({ neighborhood, fields: [{ price: 18000 }] });
    // Only an INACTIVE field is cheap: it does not count.
    await seed({
      neighborhood,
      fields: [{ price: 5000, active: false }, { price: 18000 }],
    });

    const slugs = async (qs: string) =>
      (await search(`${q(token)}&${qs}`)).items.map((item) => item.slug).sort();
    expect(await slugs('maxPrice=150')).toEqual(
      [cheap.slug, edge.slug, viaRule.slug].sort(),
    );
    expect(await slugs('maxPrice=149')).toEqual(
      [cheap.slug, viaRule.slug].sort(),
    );
    expect(await slugs('maxPrice=180')).toHaveLength(5);
    expect(await slugs('maxPrice=90')).toEqual([cheap.slug]);
    expect(await slugs('maxPrice=1')).toEqual([]);
  });

  it('combina amenities, maxPrice e esporte', async () => {
    const token = uniqueToken();
    const neighborhood = `Combo ${token}`;
    const match = await seed({
      neighborhood,
      amenities: ['coberta'],
      fields: [{ sports: ['padel'], price: 10000 }],
    });
    await seed({
      neighborhood,
      amenities: ['coberta'],
      fields: [{ sports: ['padel'], price: 20000 }],
    });
    await seed({
      neighborhood,
      amenities: ['bar'],
      fields: [{ sports: ['padel'], price: 10000 }],
    });
    await seed({
      neighborhood,
      amenities: ['coberta'],
      fields: [{ sports: ['futsal'], price: 10000 }],
    });
    const body = await search(
      `${q(token)}&amenities=coberta&maxPrice=150&sport=padel`,
    );
    expect(body.items.map((item) => item.slug)).toEqual([match.slug]);
  });
});

/** Ids of the venue's fields, oldest first. */
async function fieldIdsOf(venueId: string): Promise<string[]> {
  const rows = await handle.db
    .select({ id: field.id })
    .from(field)
    .where(eq(field.venueId, venueId))
    .orderBy(field.createdAt, field.id);
  return rows.map((row) => row.id);
}

const everyDay = (openMinute: number, closeMinute: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    openMinute,
    closeMinute,
  }));

describe('nextFreeTime (relógio fixo, banco real)', () => {
  const today = spDate(0);
  const hhmm = (time: string): Date => at(today, time);
  const tomorrow = (time: string): Date => at(spDate(1), time);

  /** The venue as `loadNextFreeTimes` sees it. */
  async function asInput(
    row: { id: string },
    hours: { weekday: number; openMinute: number; closeMinute: number }[],
  ) {
    const fields = (await fieldIdsOf(row.id)).map((id) => ({
      id,
      minSlotMinutes: 60,
    }));
    return { id: row.id, timezone: SP, hours, fields };
  }

  it('reserva confirmada 19:30-21:00 com agora 19:10: 21:00; bloqueio e hold vivo também ocupam', async () => {
    const hours = everyDay(420, 1440);
    const row = await seed({ hours });
    const [fieldId] = await fieldIdsOf(row.id);
    if (!fieldId) throw new Error('sem quadra');
    const seeded = {
      slug: row.slug,
      venueId: row.id,
      fieldId,
      inactiveFieldId: fieldId,
    };
    const input = await asInput(row, hours);
    const now = hhmm('19:10');
    const free = async () =>
      (await loadNextFreeTimes(handle.db, [input], now)).get(row.id);

    expect(await free()).toBe('19:30');
    await insertBooking(
      handle,
      seeded,
      ownerId,
      hhmm('19:30'),
      hhmm('21:00'),
      'confirmed',
    );
    expect(await free()).toBe('21:00');

    // A block from 21:00 to 22:00 pushes it on.
    await handle.db.insert(availabilityBlock).values({
      fieldId,
      period: { startsAt: hhmm('21:00'), endsAt: hhmm('22:00') },
      reason: 'manutenção',
    });
    expect(await free()).toBe('22:00');

    // A hold still alive at `now` occupies it...
    await insertBooking(
      handle,
      seeded,
      ownerId,
      hhmm('22:00'),
      hhmm('23:00'),
      'held',
      hhmm('22:30'),
    );
    expect(await free()).toBe('23:00');
    // ...a cancelled booking and a hold already expired at `now` do not.
    await insertBooking(
      handle,
      seeded,
      ownerId,
      hhmm('23:00'),
      tomorrow('00:00'),
      'cancelled',
    );
    await insertBooking(
      handle,
      seeded,
      ownerId,
      tomorrow('00:00'),
      tomorrow('01:00'),
      'held',
      hhmm('19:00'),
    );
    expect(await free()).toBe('23:00');
  });

  it('depois de uma reserva 19:30-21:00 (agora 19:10): os 3 primeiros horários livres', async () => {
    const hours = everyDay(420, 1440);
    const row = await seed({ hours });
    const [fieldId] = await fieldIdsOf(row.id);
    if (!fieldId) throw new Error('sem quadra');
    await insertBooking(
      handle,
      { slug: row.slug, venueId: row.id, fieldId, inactiveFieldId: fieldId },
      ownerId,
      hhmm('19:30'),
      hhmm('21:00'),
      'confirmed',
    );
    const input = await asInput(row, hours);

    const free = await loadFreeTimes(handle.db, [input], hhmm('19:10'));
    expect(free.get(row.id)).toEqual(['21:00', '21:30', '22:00']);
    const next = await loadNextFreeTimes(handle.db, [input], hhmm('19:10'));
    expect(next.get(row.id)).toBe('21:00');
  });

  it('tudo ocupado, fechado hoje e 23:40 com mínimo de 60 min: null', async () => {
    const allDay = everyDay(0, 1440);
    const blocked = await seed({ hours: allDay });
    const [blockedField] = await fieldIdsOf(blocked.id);
    if (!blockedField) throw new Error('sem quadra');
    await handle.db.insert(availabilityBlock).values({
      fieldId: blockedField,
      period: {
        startsAt: at(spDate(-1), '00:00'),
        endsAt: at(spDate(2), '00:00'),
      },
      reason: 'reforma',
    });
    const todayWeekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    const closedHours = everyDay(420, 1440).filter(
      (row) => row.weekday !== todayWeekday,
    );
    const closed = await seed({ hours: closedHours });
    const lateHours = everyDay(420, 1440);
    const late = await seed({ hours: lateHours });

    const result = await loadNextFreeTimes(
      handle.db,
      [
        await asInput(blocked, allDay),
        await asInput(closed, closedHours),
        await asInput(late, lateHours),
      ],
      hhmm('12:00'),
    );
    expect(result.get(blocked.id)).toBeNull();
    expect(result.get(closed.id)).toBeNull();
    expect(result.get(late.id)).toBe('12:00');

    const lateAt2340 = await loadNextFreeTimes(
      handle.db,
      [await asInput(late, lateHours)],
      hhmm('23:40'),
    );
    expect(lateAt2340.get(late.id)).toBeNull();
  });

  it('uma consulta de ocupação para todas as quadras de todos os espaços', async () => {
    const hours = everyDay(420, 1440);
    const rows = [
      await seed({ hours, fields: [{}, {}] }),
      await seed({ hours }),
      await seed({ hours, fields: [] }),
    ];
    const inputs = [];
    for (const row of rows) inputs.push(await asInput(row, hours));
    const spy = vi.spyOn(handle.pool, 'query');
    const result = await loadNextFreeTimes(handle.db, inputs, hhmm('10:00'));
    const queries = spy.mock.calls.length;
    spy.mockRestore();
    expect(queries).toBe(1);
    expect(rows.map((row) => result.get(row.id))).toEqual([
      '10:00',
      '10:00',
      null,
    ]);
  });
});

describe('GET /api/venues: nextFreeTime (relógio do banco)', () => {
  it('cada card traz o seu próximo horário livre de hoje; ocupado ou sem horário é null', async (ctx) => {
    // The slot grid follows the clock: too close to midnight nothing is free.
    if (localMinuteOf(new Date(), SP) > 21 * 60) ctx.skip();
    const token = uniqueToken();
    const neighborhood = `Livre hoje ${token}`;
    const open = await seed({ neighborhood, hours: everyDay(0, 1440) });
    const blocked = await seed({ neighborhood, hours: everyDay(0, 1440) });
    const noHours = await seed({ neighborhood });
    const [blockedField] = await fieldIdsOf(blocked.id);
    if (!blockedField) throw new Error('sem quadra');
    await handle.db.insert(availabilityBlock).values({
      fieldId: blockedField,
      period: {
        startsAt: at(spDate(-1), '00:00'),
        endsAt: at(spDate(2), '00:00'),
      },
      reason: 'reforma',
    });

    const before = localMinuteOf(new Date(), SP);
    const body = await search(q(token));
    const bySlug = new Map(body.items.map((item) => [item.slug, item]));
    expect(bySlug.get(blocked.slug)?.nextFreeTime).toBeNull();
    expect(bySlug.get(blocked.slug)?.freeTimes).toEqual([]);
    expect(bySlug.get(noHours.slug)?.nextFreeTime).toBeNull();
    expect(bySlug.get(noHours.slug)?.freeTimes).toEqual([]);
    const openFree = bySlug.get(open.slug)?.freeTimes ?? [];
    // Up to 3, ascending, the first is nextFreeTime.
    expect(openFree.length).toBeGreaterThan(0);
    expect(openFree.length).toBeLessThanOrEqual(3);
    expect(openFree).toEqual([...openFree].sort());
    expect(openFree[0]).toBe(bySlug.get(open.slug)?.nextFreeTime);
    const time = bySlug.get(open.slug)?.nextFreeTime;
    expect(time).toMatch(/^\d{2}:\d{2}$/);
    const [h, m] = (time ?? '00:00').split(':').map(Number) as [number, number];
    // First 30 minute slot start at or after now.
    expect(h * 60 + m).toBeGreaterThanOrEqual(before);
    expect(h * 60 + m).toBeLessThanOrEqual(before + 31);
    expect((h * 60 + m) % 30).toBe(0);
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
        { key: `det-${token}-a`, position: 0, variantWidths: [400] },
      ],
      timezone: 'America/Manaus',
      hours: [
        { weekday: 5, openMinute: 1020, closeMinute: 1440 },
        { weekday: 5, openMinute: 480, closeMinute: 720 },
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
    expect(body.timezone).toBe('America/Manaus');
    expect(body.hours).toEqual([
      { weekday: 1, openMinute: 540, closeMinute: 1200 },
      { weekday: 5, openMinute: 480, closeMinute: 720 },
      { weekday: 5, openMinute: 1020, closeMinute: 1440 },
    ]);
    expect(body.photos.map((photo) => photo.position)).toEqual([0, 1]);
    expect(body.photos[0]?.url).toContain(`det-${token}-a`);
    expect(body.photos[0]?.srcSet).toBe(
      `${body.photos[0]?.url ?? ''}.w400.webp 400w`,
    );
    expect(body.photos[1]?.srcSet).toBeNull();
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
