import { randomUUID } from 'node:crypto';
import {
  VENUE_HOURS_MESSAGE,
  venueSchema,
  venueSummarySchema,
  type Problem,
  type Venue,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { LightMyRequestResponse } from 'fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { VenuesService } from '../src/venues/venues.service.js';
import {
  asUser,
  buildTestApp,
  signUpAs,
  uniqueToken,
  venueBody,
} from './helpers.js';

let app: NestFastifyApplication;
let handle: DbHandle;

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
});

afterAll(async () => {
  await app.close();
});

async function newOwner(name = 'Dono') {
  const { cookie, userId } = await signUpAs(app, name);
  return { userId, api: asUser(app, cookie) };
}

function venueOf(res: LightMyRequestResponse): Venue {
  expect(res.statusCode).toBeLessThan(300);
  return venueSchema.parse(res.json());
}

/** Direct inserts: the field and photo routes arrive in Tasks 4 and 5. */
async function addField(venueId: string, isActive = true) {
  await handle.db.insert(schema.field).values({
    venueId,
    name: `Quadra ${uniqueToken()}`,
    sports: ['futsal'],
    surface: 'piso_rigido',
    format: null,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 8000,
    isActive,
  });
}

async function addPhoto(venueId: string, position = 0) {
  const storageKey = `venues/${venueId}/${randomUUID()}.jpg`;
  await handle.db
    .insert(schema.venuePhoto)
    .values({ venueId, storageKey, position });
  return storageKey;
}

const problemOf = (res: LightMyRequestResponse): Problem => res.json<Problem>();

/** Lets the clock move past the row's timestamps (ms resolution in JSON). */
const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 10));

const HOURS = [
  { weekday: 1, openMinute: 480, closeMinute: 1320 },
  { weekday: 6, openMinute: 540, closeMinute: 1200 },
];

describe('owner venues e2e', () => {
  it('cria, lista, lê e edita o próprio espaço', async () => {
    const { api } = await newOwner();
    const token = uniqueToken();
    const created = await api.post(
      '/api/owner/venues',
      venueBody({ name: `Arena Vila Madalena ${token}` }),
    );
    expect(created.statusCode).toBe(201);
    const venue = venueOf(created);
    expect(venue).toMatchObject({
      slug: `arena-vila-madalena-${token}`,
      status: 'draft',
      phone: '+5511987654321',
      address: { cep: '01310100', city: 'São Paulo', complement: null },
      location: { lat: -23.5614, lng: -46.6559 },
      amenities: ['vestiario', 'estacionamento'],
      hours: [],
      photos: [],
      fields: [],
    });

    const list = await api.get('/api/owner/venues');
    expect(list.statusCode).toBe(200);
    const summaries = venueSummarySchema.array().parse(list.json());
    expect(summaries).toEqual([
      {
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        status: 'draft',
        city: 'São Paulo',
        fieldsCount: 0,
        coverUrl: null,
      },
    ]);

    const read = await api.get(`/api/owner/venues/${venue.id}`);
    expect(read.statusCode).toBe(200);
    expect(venueOf(read)).toEqual(venue);

    await tick();
    const patched = await api.patch(`/api/owner/venues/${venue.id}`, {
      name: `Arena Renomeada ${token}`,
      phone: '11 3333-4444',
      amenities: ['wifi'],
      address: {
        ...venueBody().address,
        cep: '04538133',
        complement: 'Sala 2',
      },
    });
    expect(patched.statusCode).toBe(200);
    const after = venueOf(patched);
    expect(after).toMatchObject({
      name: `Arena Renomeada ${token}`,
      slug: venue.slug,
      phone: '+551133334444',
      amenities: ['wifi'],
      address: { cep: '04538133', complement: 'Sala 2' },
      createdAt: venue.createdAt,
    });
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(
      Date.parse(venue.updatedAt),
    );
  });

  it('PATCH com corpo vazio não altera nada e responde 200', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const res = await api.patch(`/api/owner/venues/${venue.id}`, {});
    expect(res.statusCode).toBe(200);
    expect(venueOf(res)).toEqual(venue);
  });

  it('dados inválidos → 422 com erros por campo', async () => {
    const { api } = await newOwner();
    const res = await api.post('/api/owner/venues', {
      ...venueBody(),
      name: 'ab',
      phone: '123',
    });
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const errors = problemOf(res).errors ?? {};
    expect(errors.name).toBeDefined();
    expect(errors.phone).toEqual(['Telefone inválido']);
  });

  it('slug repetido ganha sufixo', async () => {
    const { api } = await newOwner();
    const { api: other } = await newOwner('Outro');
    const token = uniqueToken();
    const body = venueBody({ name: `Arena Vila Madalena ${token}` });
    const first = venueOf(await api.post('/api/owner/venues', body));
    const second = venueOf(await other.post('/api/owner/venues', body));
    const third = venueOf(await api.post('/api/owner/venues', body));
    expect(first.slug).toBe(`arena-vila-madalena-${token}`);
    expect(second.slug).toBe(`arena-vila-madalena-${token}-2`);
    expect(third.slug).toBe(`arena-vila-madalena-${token}-3`);
  });

  it('criações simultâneas com o mesmo nome recebem slugs distintos', async () => {
    const { api } = await newOwner();
    const body = venueBody({ name: `Arena Corrida ${uniqueToken()}` });
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => api.post('/api/owner/venues', body)),
    );
    const slugs = responses.map((res) => venueOf(res).slug);
    expect(new Set(slugs).size).toBe(5);
  });

  it('colisão de slug entre a checagem e o insert tenta o próximo sufixo', async () => {
    const { api } = await newOwner();
    const body = venueBody({ name: `Arena Disputada ${uniqueToken()}` });
    const first = venueOf(await api.post('/api/owner/venues', body));
    // Simulates losing the race: the slug looked free but was already taken.
    const spy = vi
      .spyOn(app.get(VenuesService), 'uniqueSlug')
      .mockResolvedValueOnce(first.slug);
    try {
      const second = venueOf(await api.post('/api/owner/venues', body));
      expect(second.slug).toBe(`${first.slug}-2`);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('outro dono recebe 404 em GET, PATCH, DELETE, hours, publish e unpublish', async () => {
    const { api: a } = await newOwner('Dono A');
    const { api: b } = await newOwner('Dono B');
    const venue = venueOf(await a.post('/api/owner/venues', venueBody()));
    const base = `/api/owner/venues/${venue.id}`;

    const attempts = await Promise.all([
      b.get(base),
      b.patch(base, { name: 'Invadido' }),
      b.del(base),
      b.put(`${base}/hours`, HOURS),
      b.post(`${base}/publish`),
      b.post(`${base}/unpublish`),
    ]);
    for (const res of attempts) {
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json()).toMatchObject({
        status: 404,
        detail: 'Espaço não encontrado',
      });
    }

    expect(venueOf(await a.get(base))).toEqual(venue);
    expect((await b.get('/api/owner/venues')).json()).toEqual([]);
  });

  it('corpo inválido de outro dono responde igual a um espaço inexistente', async () => {
    const { api: a } = await newOwner('Dono A');
    const { api: b } = await newOwner('Dono B');
    const venue = venueOf(await a.post('/api/owner/venues', venueBody()));
    const ghost = randomUUID();

    const cases: [string, (id: string) => Promise<LightMyRequestResponse>][] = [
      ['PATCH', (id) => b.patch(`/api/owner/venues/${id}`, { name: 'ab' })],
      ['PUT hours', (id) => b.put(`/api/owner/venues/${id}/hours`, [{}])],
    ];
    for (const [, send] of cases) {
      const real = await send(venue.id);
      const missing = await send(ghost);
      expect(real.statusCode).toBe(missing.statusCode);
      expect(real.json()).toEqual(missing.json());
    }
  });

  it('sem login → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/owner/venues' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ detail: 'Faça login para continuar' });
    const post = await app.inject({
      method: 'POST',
      url: '/api/owner/venues',
      payload: venueBody(),
    });
    expect(post.statusCode).toBe(401);
  });

  it('id malformado ou inexistente → 404, não 500', async () => {
    const { api } = await newOwner();
    for (const id of ['not-a-uuid', randomUUID()]) {
      const res = await api.get(`/api/owner/venues/${id}`);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ detail: 'Espaço não encontrado' });
    }
    const del = await api.del('/api/owner/venues/not-a-uuid');
    expect(del.statusCode).toBe(404);
  });

  it('publicar incompleto lista o que falta', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const id = venue.id;
    const res = await api.post(`/api/owner/venues/${id}/publish`);
    expect(res.statusCode).toBe(422);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({
      status: 422,
      detail: 'Complete o espaço antes de publicar',
    });
    expect(problemOf(res).errors).toEqual({
      hours: ['Defina o horário de funcionamento'],
      fields: ['Cadastre ao menos uma quadra ativa'],
      photos: ['Envie ao menos uma foto'],
    });
    expect(venueOf(await api.get(`/api/owner/venues/${id}`)).status).toBe(
      'draft',
    );
  });

  it('publica quando tem horário, quadra ativa e foto; despublica', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const base = `/api/owner/venues/${venue.id}`;

    await api.put(`${base}/hours`, HOURS);
    // An inactive field does not count.
    await addField(venue.id, false);
    const missing = await api.post(`${base}/publish`);
    expect(missing.statusCode).toBe(422);
    expect(problemOf(missing).errors).toEqual({
      fields: ['Cadastre ao menos uma quadra ativa'],
      photos: ['Envie ao menos uma foto'],
    });

    await addField(venue.id);
    const key = await addPhoto(venue.id);
    const published = await api.post(`${base}/publish`);
    expect(published.statusCode).toBe(200);
    const live = venueOf(published);
    expect(live.status).toBe('published');
    expect(live.fields).toHaveLength(2);
    expect(live.fields[0]).toMatchObject({
      priceRulesCount: 0,
      lengthM: null,
      format: null,
    });
    expect(live.photos).toHaveLength(1);
    expect(live.photos[0]).toMatchObject({ url: `/${key}`, position: 0 });

    const summary = venueSummarySchema
      .array()
      .parse((await api.get('/api/owner/venues')).json());
    expect(summary[0]).toMatchObject({
      status: 'published',
      fieldsCount: 2,
      coverUrl: `/${key}`,
    });

    const draft = await api.post(`${base}/unpublish`);
    expect(draft.statusCode).toBe(200);
    expect(venueOf(draft).status).toBe('draft');
  });

  it('espaço publicado não pode perder o horário', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const base = `/api/owner/venues/${venue.id}`;
    await api.put(`${base}/hours`, HOURS);
    await addField(venue.id);
    await addPhoto(venue.id);
    expect((await api.post(`${base}/publish`)).statusCode).toBe(200);

    const res = await api.put(`${base}/hours`, []);
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({
      detail: 'Despublique o espaço antes de deixá-lo incompleto',
      errors: { hours: ['Defina o horário de funcionamento'] },
    });
    const after = venueOf(await api.get(base));
    expect(after.status).toBe('published');
    expect(after.hours).toEqual(HOURS);

    // Replacing with other (non-empty) hours is fine.
    const other = [{ weekday: 3, openMinute: 480, closeMinute: 720 }];
    expect(venueOf(await api.put(`${base}/hours`, other)).hours).toEqual(other);

    // A draft may be emptied.
    await api.post(`${base}/unpublish`);
    expect(venueOf(await api.put(`${base}/hours`, [])).hours).toEqual([]);
  });

  it('horário substitui o anterior e valida', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const url = `/api/owner/venues/${venue.id}/hours`;

    await tick();
    const first = await api.put(url, [HOURS[1], HOURS[0]]);
    expect(first.statusCode).toBe(200);
    const withHours = venueOf(first);
    expect(withHours.hours).toEqual(HOURS);
    expect(Date.parse(withHours.updatedAt)).toBeGreaterThan(
      Date.parse(venue.updatedAt),
    );

    const second = await api.put(url, [
      { weekday: 0, openMinute: 600, closeMinute: 900 },
    ]);
    expect(venueOf(second).hours).toEqual([
      { weekday: 0, openMinute: 600, closeMinute: 900 },
    ]);

    const invalid = await api.put(url, [
      { weekday: 2, openMinute: 600, closeMinute: 600 },
    ]);
    expect(invalid.statusCode).toBe(422);
    expect(Object.values(problemOf(invalid).errors ?? {}).flat()).toContain(
      VENUE_HOURS_MESSAGE,
    );

    const duplicated = await api.put(url, [HOURS[0], HOURS[0]]);
    expect(duplicated.statusCode).toBe(422);

    // Failed requests leave the previous hours untouched.
    const kept = venueOf(await api.get(`/api/owner/venues/${venue.id}`));
    expect(kept.hours).toEqual([
      { weekday: 0, openMinute: 600, closeMinute: 900 },
    ]);

    const cleared = await api.put(url, []);
    expect(venueOf(cleared).hours).toEqual([]);
  });

  it('apaga o espaço e o que depende dele', async () => {
    const { api } = await newOwner();
    const venue = venueOf(await api.post('/api/owner/venues', venueBody()));
    const base = `/api/owner/venues/${venue.id}`;
    await api.put(`${base}/hours`, HOURS);
    await addField(venue.id);
    await addPhoto(venue.id);

    const res = await api.del(base);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect((await api.get(base)).statusCode).toBe(404);
    expect((await api.del(base)).statusCode).toBe(404);

    for (const table of [schema.venueHours, schema.field, schema.venuePhoto]) {
      const rows = await handle.db
        .select()
        .from(table)
        .where(eq(table.venueId, venue.id));
      expect(rows).toEqual([]);
    }
  });
});
