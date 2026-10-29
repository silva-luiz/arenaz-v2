import { randomUUID } from 'node:crypto';
import {
  blockSchema,
  fieldSchema,
  priceRuleSchema,
  venueSchema,
  type FieldInput,
  type Problem,
  type Venue,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import { NotFoundException } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { findOwnedField } from '../src/venues/owner.js';
import {
  asUser,
  buildTestApp,
  signUpAs,
  uniqueToken,
  venueBody,
  type AsUser,
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

function fieldBody(overrides: Partial<FieldInput> = {}): FieldInput {
  return {
    name: `Quadra ${uniqueToken()}`,
    sports: ['futsal', 'volei_praia'],
    surface: 'piso_rigido',
    format: null,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 8000,
    isActive: true,
    ...overrides,
  };
}

const problemOf = (res: LightMyRequestResponse): Problem => res.json<Problem>();

async function newVenue(api: AsUser): Promise<Venue> {
  const res = await api.post('/api/owner/venues', venueBody());
  expect(res.statusCode).toBe(201);
  return venueSchema.parse(res.json());
}

async function newField(
  api: AsUser,
  venueId: string,
  overrides: Partial<FieldInput> = {},
) {
  const res = await api.post(
    `/api/owner/venues/${venueId}/fields`,
    fieldBody(overrides),
  );
  expect(res.statusCode).toBe(201);
  return fieldSchema.parse(res.json());
}

/** An owner with a venue and one field. */
async function setup() {
  const owner = await newOwner();
  const venue = await newVenue(owner.api);
  const field = await newField(owner.api, venue.id);
  return { ...owner, venue, field };
}

const RULE = {
  weekdays: [5, 6],
  startMinute: 1080,
  endMinute: 1320,
  priceCentsPerHour: 12000,
};

const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();

/** Hours + photo + one active field + publish, via API and direct inserts. */
async function publishedVenue() {
  const owner = await newOwner();
  const venue = await newVenue(owner.api);
  const field = await newField(owner.api, venue.id);
  const put = await owner.api.put(`/api/owner/venues/${venue.id}/hours`, [
    { weekday: 1, openMinute: 480, closeMinute: 1320 },
  ]);
  expect(put.statusCode).toBe(200);
  await handle.db.insert(schema.venuePhoto).values({
    venueId: venue.id,
    storageKey: `venues/${venue.id}/${randomUUID()}.jpg`,
    position: 0,
  });
  const published = await owner.api.post(
    `/api/owner/venues/${venue.id}/publish`,
  );
  expect(published.statusCode).toBe(200);
  return { ...owner, venue, field };
}

describe('owner fields e2e', () => {
  it('CRUD de quadra no próprio espaço', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);

    const created = await api.post(
      `/api/owner/venues/${venue.id}/fields`,
      fieldBody({
        name: 'Quadra 1',
        format: '7x7',
        lengthM: 40.5,
        widthM: 20,
      }),
    );
    expect(created.statusCode).toBe(201);
    const field = fieldSchema.parse(created.json());
    expect(field).toMatchObject({
      venueId: venue.id,
      name: 'Quadra 1',
      sports: ['futsal', 'volei_praia'],
      surface: 'piso_rigido',
      format: '7x7',
      lengthM: 40.5,
      widthM: 20,
      minSlotMinutes: 60,
      basePriceCentsPerHour: 8000,
      isActive: true,
      priceRules: [],
      blocks: [],
    });

    const read = await api.get(`/api/owner/fields/${field.id}`);
    expect(read.statusCode).toBe(200);
    expect(fieldSchema.parse(read.json())).toEqual(field);

    const patched = await api.patch(`/api/owner/fields/${field.id}`, {
      basePriceCentsPerHour: 9500,
      name: 'Quadra Central',
    });
    expect(patched.statusCode).toBe(200);
    expect(fieldSchema.parse(patched.json())).toEqual({
      ...field,
      basePriceCentsPerHour: 9500,
      name: 'Quadra Central',
    });

    const empty = await api.patch(`/api/owner/fields/${field.id}`, {});
    expect(empty.statusCode).toBe(200);
    expect(fieldSchema.parse(empty.json()).isActive).toBe(true);

    const removed = await api.del(`/api/owner/fields/${field.id}`);
    expect(removed.statusCode).toBe(204);
    expect(removed.body).toBe('');
    expect((await api.get(`/api/owner/fields/${field.id}`)).statusCode).toBe(
      404,
    );
  });

  it('medida que arredonda para 0,0 → 422 e nada é gravado', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const create = await api.post(
      `/api/owner/venues/${venue.id}/fields`,
      fieldBody({ lengthM: 0.04 }),
    );
    expect(create.statusCode).toBe(422);
    expect(JSON.stringify(problemOf(create).errors)).toContain(
      'Use metros com até 1 casa decimal (mínimo 0,1)',
    );
    const stored = await handle.db
      .select()
      .from(schema.field)
      .where(eq(schema.field.venueId, venue.id));
    expect(stored).toHaveLength(0);

    // The venue page still loads, and a PATCH with the same value is refused
    // without touching the stored measures.
    expect((await api.get(`/api/owner/venues/${venue.id}`)).statusCode).toBe(
      200,
    );
    const field = await newField(api, venue.id, { lengthM: 40.5 });
    const patch = await api.patch(`/api/owner/fields/${field.id}`, {
      widthM: 0.04,
    });
    expect(patch.statusCode).toBe(422);
    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read).toMatchObject({ lengthM: 40.5, widthM: null });
  });

  it('a quadra sem medidas devolve lengthM e widthM nulos', async () => {
    const { field } = await setup();
    expect(field.lengthM).toBeNull();
    expect(field.widthM).toBeNull();
  });

  it('PATCH com lengthM/widthM null limpa as medidas; ausente não mexe', async () => {
    const { api, venue } = await setup();
    const created = await api.post(
      `/api/owner/venues/${venue.id}/fields`,
      fieldBody({ lengthM: 40.5, widthM: 20 }),
    );
    const id = fieldSchema.parse(created.json()).id;

    const untouched = await api.patch(`/api/owner/fields/${id}`, {
      name: 'Outra',
    });
    expect(untouched.statusCode).toBe(200);
    expect(fieldSchema.parse(untouched.json())).toMatchObject({
      lengthM: 40.5,
      widthM: 20,
    });

    const onlyLength = await api.patch(`/api/owner/fields/${id}`, {
      lengthM: null,
    });
    expect(onlyLength.statusCode).toBe(200);
    expect(fieldSchema.parse(onlyLength.json())).toMatchObject({
      lengthM: null,
      widthM: 20,
    });

    const both = await api.patch(`/api/owner/fields/${id}`, {
      lengthM: null,
      widthM: null,
    });
    expect(fieldSchema.parse(both.json())).toMatchObject({
      lengthM: null,
      widthM: null,
    });
    const read = await api.get(`/api/owner/fields/${id}`);
    expect(fieldSchema.parse(read.json())).toMatchObject({
      lengthM: null,
      widthM: null,
    });
  });

  it('o espaço passa a listar as quadras com a contagem de faixas', async () => {
    const { api, venue, field } = await setup();
    const rules = await api.put(`/api/owner/fields/${field.id}/price-rules`, [
      RULE,
    ]);
    expect(rules.statusCode).toBe(200);

    const read = await api.get(`/api/owner/venues/${venue.id}`);
    const fields = venueSchema.parse(read.json()).fields;
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      id: field.id,
      name: field.name,
      isActive: true,
      priceRulesCount: 1,
    });
  });

  it('dados inválidos → 422; preço não inteiro → 422', async () => {
    const { api, venue, field } = await setup();
    const url = `/api/owner/venues/${venue.id}/fields`;

    const fractional = await api.post(url, {
      ...fieldBody(),
      basePriceCentsPerHour: 100.5,
    });
    expect(fractional.statusCode).toBe(422);
    expect(fractional.headers['content-type']).toContain(
      'application/problem+json',
    );
    expect(problemOf(fractional).errors?.basePriceCentsPerHour).toBeDefined();

    const bad = await api.post(url, { ...fieldBody(), sports: [], name: 'x' });
    expect(bad.statusCode).toBe(422);
    expect(problemOf(bad).errors).toMatchObject({
      sports: expect.any(Array) as string[],
      name: expect.any(Array) as string[],
    });

    const patch = await api.patch(`/api/owner/fields/${field.id}`, {
      basePriceCentsPerHour: 100.5,
    });
    expect(patch.statusCode).toBe(422);
  });

  it('exige autenticação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/owner/fields/${randomUUID()}`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('id malformado → 404 (findOwnedField e rota)', async () => {
    const { api, userId } = await setup();
    await expect(
      findOwnedField(handle.db, 'não-é-uuid', userId),
    ).rejects.toThrow(new NotFoundException('Quadra não encontrada'));

    for (const res of [
      await api.get('/api/owner/fields/abc'),
      await api.patch('/api/owner/fields/abc', {}),
      await api.del('/api/owner/fields/abc'),
      await api.put('/api/owner/fields/abc/price-rules', []),
      await api.post('/api/owner/fields/abc/blocks', {
        startsAt: hours(1),
        endsAt: hours(2),
      }),
      await api.del('/api/owner/blocks/abc'),
      await api.post('/api/owner/venues/abc/fields', fieldBody()),
    ]) {
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(problemOf(res).detail).toMatch(/não encontrad/);
    }
  });

  it('findOwnedField encontra a própria quadra e esconde a de outro dono', async () => {
    const { userId, field } = await setup();
    const { userId: otherId } = await newOwner('Outro');
    await expect(
      findOwnedField(handle.db, field.id, userId),
    ).resolves.toMatchObject({ id: field.id });
    await expect(findOwnedField(handle.db, field.id, otherId)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('price rules e2e', () => {
  it('faixas sobrepostas → 422 no campo', async () => {
    const { api, field } = await setup();
    const res = await api.put(`/api/owner/fields/${field.id}/price-rules`, [
      {
        weekdays: [5],
        startMinute: 1080,
        endMinute: 1320,
        priceCentsPerHour: 20000,
      },
      {
        weekdays: [5, 6],
        startMinute: 1200,
        endMinute: 1260,
        priceCentsPerHour: 30000,
      },
    ]);
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(problemOf(res).errors)).toContain(
      'Faixas de preço se sobrepõem',
    );
  });

  it('substitui o conjunto, ordena por dia e início, e [] limpa', async () => {
    const { api, field } = await setup();
    const url = `/api/owner/fields/${field.id}/price-rules`;
    const first = await api.put(url, [
      { ...RULE, weekdays: [6, 5], label: 'Noite' },
      {
        weekdays: [1, 2],
        startMinute: 600,
        endMinute: 720,
        priceCentsPerHour: 5000,
      },
      {
        weekdays: [1, 2],
        startMinute: 480,
        endMinute: 600,
        priceCentsPerHour: 4000,
      },
    ]);
    expect(first.statusCode).toBe(200);
    const rules = priceRuleSchema.array().parse(first.json());
    expect(rules.map((r) => [Math.min(...r.weekdays), r.startMinute])).toEqual([
      [1, 480],
      [1, 600],
      [5, 1080],
    ]);
    expect(rules[2]).toMatchObject({ label: 'Noite' });
    expect(rules[0]?.label).toBeNull();

    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read.priceRules).toEqual(rules);

    // Replace: the old rows are gone, not merged.
    const second = await api.put(url, [RULE]);
    const replaced = priceRuleSchema.array().parse(second.json());
    expect(replaced).toHaveLength(1);
    const count = await handle.db
      .select()
      .from(schema.priceRule)
      .where(eq(schema.priceRule.fieldId, field.id));
    expect(count).toHaveLength(1);

    const cleared = await api.put(url, []);
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toEqual([]);
  });

  it('conjunto inválido não altera as faixas existentes', async () => {
    const { api, field } = await setup();
    const url = `/api/owner/fields/${field.id}/price-rules`;
    await api.put(url, [RULE]);
    const bad = await api.put(url, [RULE, { ...RULE, weekdays: [5] }]);
    expect(bad.statusCode).toBe(422);
    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read.priceRules).toHaveLength(1);
  });

  it('preço da faixa acima do limite (estouraria o int4) → 422, sem gravar', async () => {
    const { api, field } = await setup();
    const url = `/api/owner/fields/${field.id}/price-rules`;
    await api.put(url, [RULE]);
    const res = await api.put(url, [
      { ...RULE, priceCentsPerHour: 3_000_000_000 },
    ]);
    expect(res.statusCode).toBe(422);
    expect(JSON.stringify(problemOf(res).errors)).toContain(
      'O preço por hora pode ser no máximo R$ 10.000,00',
    );
    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read.priceRules).toHaveLength(1);
    expect(read.priceRules[0]?.priceCentsPerHour).toBe(12000);
  });

  it('horário fora de múltiplos de 30 min → 422', async () => {
    const { api, field } = await setup();
    const res = await api.put(`/api/owner/fields/${field.id}/price-rules`, [
      { ...RULE, startMinute: 1085 },
    ]);
    expect(res.statusCode).toBe(422);
  });
});

describe('availability blocks e2e', () => {
  it('23P01 do EXCLUDE (corrida que escapou da checagem) também vira 409', async () => {
    const { api, field } = await setup();
    const exclusion = Object.assign(new Error('Failed query'), {
      // Drizzle wraps the driver error and keeps it in `cause`.
      cause: Object.assign(new Error('conflicting key value'), {
        code: '23P01',
      }),
    });
    const spy = vi
      .spyOn(handle.db, 'transaction')
      .mockRejectedValueOnce(exclusion);
    try {
      const res = await api.post(`/api/owner/fields/${field.id}/blocks`, {
        startsAt: '2031-04-10T10:00:00.000Z',
        endsAt: '2031-04-10T12:00:00.000Z',
      });
      expect(res.statusCode).toBe(409);
      expect(problemOf(res)).toMatchObject({
        status: 409,
        detail: 'Já existe um bloqueio nesse período',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('bloqueio sobreposto → 409; encostado → 201', async () => {
    const { api, field } = await setup();
    const url = `/api/owner/fields/${field.id}/blocks`;
    const start = Date.parse('2031-03-10T10:00:00.000Z');
    const iso = (offsetHours: number) =>
      new Date(start + offsetHours * 3_600_000).toISOString();

    const first = await api.post(url, {
      startsAt: iso(0),
      endsAt: iso(2),
      reason: 'Manutenção',
    });
    expect(first.statusCode).toBe(201);
    expect(blockSchema.parse(first.json())).toMatchObject({
      startsAt: iso(0),
      endsAt: iso(2),
      reason: 'Manutenção',
    });

    const overlapping = await api.post(url, {
      startsAt: iso(1),
      endsAt: iso(3),
    });
    expect(overlapping.statusCode).toBe(409);
    expect(problemOf(overlapping)).toMatchObject({
      status: 409,
      detail: 'Já existe um bloqueio nesse período',
    });

    const contained = await api.post(url, {
      startsAt: iso(0.5),
      endsAt: iso(1),
    });
    expect(contained.statusCode).toBe(409);

    const touchingAfter = await api.post(url, {
      startsAt: iso(2),
      endsAt: iso(3),
    });
    expect(touchingAfter.statusCode).toBe(201);
    const touchingBefore = await api.post(url, {
      startsAt: iso(-1),
      endsAt: iso(0),
    });
    expect(touchingBefore.statusCode).toBe(201);
    expect(blockSchema.parse(touchingBefore.json()).reason).toBeNull();
  });

  it('bloqueios de quadras diferentes não conflitam', async () => {
    const { api, venue, field } = await setup();
    const other = await newField(api, venue.id);
    const body = {
      startsAt: '2031-04-01T10:00:00.000Z',
      endsAt: '2031-04-01T12:00:00.000Z',
    };
    expect(
      (await api.post(`/api/owner/fields/${field.id}/blocks`, body)).statusCode,
    ).toBe(201);
    expect(
      (await api.post(`/api/owner/fields/${other.id}/blocks`, body)).statusCode,
    ).toBe(201);
  });

  it('pedidos simultâneos para o mesmo período: só um é criado', async () => {
    const { api, field } = await setup();
    const url = `/api/owner/fields/${field.id}/blocks`;
    const body = {
      startsAt: '2031-05-01T10:00:00.000Z',
      endsAt: '2031-05-01T12:00:00.000Z',
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api.post(url, body)),
    );
    const codes = results.map((res) => res.statusCode).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409]);
  });

  it('período inválido → 422', async () => {
    const { api, field } = await setup();
    const res = await api.post(`/api/owner/fields/${field.id}/blocks`, {
      startsAt: '2031-05-01T12:00:00.000Z',
      endsAt: '2031-05-01T10:00:00.000Z',
    });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors?.endsAt).toBeDefined();
  });

  it('a quadra lista só bloqueios futuros ou em andamento, por início', async () => {
    const { api, field } = await setup();
    const rows = [
      { startsAt: new Date(Date.now() - 48 * 3_600_000), h: -46, tag: 'past' },
      { startsAt: new Date(Date.now() - 3_600_000), h: 1, tag: 'ongoing' },
      { startsAt: new Date(Date.now() + 48 * 3_600_000), h: 50, tag: 'later' },
      { startsAt: new Date(Date.now() + 24 * 3_600_000), h: 26, tag: 'soon' },
    ];
    for (const row of rows) {
      await handle.db.insert(schema.availabilityBlock).values({
        fieldId: field.id,
        period: {
          startsAt: row.startsAt,
          endsAt: new Date(row.startsAt.getTime() + 2 * 3_600_000),
        },
        reason: row.tag,
      });
    }
    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read.blocks.map((block) => block.reason)).toEqual([
      'ongoing',
      'soon',
      'later',
    ]);
  });

  it('remove o próprio bloqueio (204) e depois responde 404', async () => {
    const { api, field } = await setup();
    const created = await api.post(`/api/owner/fields/${field.id}/blocks`, {
      startsAt: '2031-06-01T10:00:00.000Z',
      endsAt: '2031-06-01T12:00:00.000Z',
    });
    const block = blockSchema.parse(created.json());
    const removed = await api.del(`/api/owner/blocks/${block.id}`);
    expect(removed.statusCode).toBe(204);
    const again = await api.del(`/api/owner/blocks/${block.id}`);
    expect(again.statusCode).toBe(404);
    expect(problemOf(again).detail).toBe('Bloqueio não encontrado');
  });
});

describe('ownership e2e', () => {
  it('outro dono recebe 404 em quadra, faixas e bloqueios; nada muda', async () => {
    const a = await setup();
    const b = await newOwner('Dono B');
    const blockRes = await a.api.post(
      `/api/owner/fields/${a.field.id}/blocks`,
      {
        startsAt: '2031-07-01T10:00:00.000Z',
        endsAt: '2031-07-01T12:00:00.000Z',
      },
    );
    const block = blockSchema.parse(blockRes.json());
    await a.api.put(`/api/owner/fields/${a.field.id}/price-rules`, [RULE]);
    const before = fieldSchema.parse(
      (await a.api.get(`/api/owner/fields/${a.field.id}`)).json(),
    );

    const attempts = [
      b.api.post(`/api/owner/venues/${a.venue.id}/fields`, fieldBody()),
      b.api.get(`/api/owner/fields/${a.field.id}`),
      b.api.patch(`/api/owner/fields/${a.field.id}`, { name: 'Invadida' }),
      b.api.put(`/api/owner/fields/${a.field.id}/price-rules`, []),
      b.api.post(`/api/owner/fields/${a.field.id}/blocks`, {
        startsAt: '2031-08-01T10:00:00.000Z',
        endsAt: '2031-08-01T12:00:00.000Z',
      }),
      b.api.del(`/api/owner/blocks/${block.id}`),
      b.api.del(`/api/owner/fields/${a.field.id}`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }

    const after = fieldSchema.parse(
      (await a.api.get(`/api/owner/fields/${a.field.id}`)).json(),
    );
    expect(after).toEqual(before);
    const venue = venueSchema.parse(
      (await a.api.get(`/api/owner/venues/${a.venue.id}`)).json(),
    );
    expect(venue.fields).toHaveLength(1);
  });

  it('a resposta do dono B é igual para recurso de A e para uuid aleatório (validação primeiro)', async () => {
    const a = await setup();
    const b = await newOwner('Dono B');
    const random = randomUUID();
    const strip = (res: LightMyRequestResponse) => ({
      status: res.statusCode,
      problem: problemOf(res),
    });
    const same = async (
      call: (id: string) => Promise<LightMyRequestResponse>,
    ) => {
      expect(strip(await call(a.field.id))).toEqual(strip(await call(random)));
    };

    await same((id) => b.api.get(`/api/owner/fields/${id}`));
    // Invalid bodies: validation (422) runs before the ownership lookup.
    await same((id) =>
      b.api.patch(`/api/owner/fields/${id}`, { basePriceCentsPerHour: 1.5 }),
    );
    await same((id) =>
      b.api.put(`/api/owner/fields/${id}/price-rules`, [
        { ...RULE, startMinute: 7 },
      ]),
    );
    await same((id) =>
      b.api.post(`/api/owner/fields/${id}/blocks`, {
        startsAt: 'ontem',
        endsAt: 'hoje',
      }),
    );
    const onVenue = (id: string) =>
      b.api.post(`/api/owner/venues/${id}/fields`, { name: 'x' });
    expect(strip(await onVenue(a.venue.id))).toEqual(
      strip(await onVenue(random)),
    );
  });
});

describe('published venues stay complete e2e', () => {
  it('desativar a última quadra ativa de um espaço publicado → 422 e nada muda', async () => {
    const { api, venue, field } = await publishedVenue();
    const res = await api.patch(`/api/owner/fields/${field.id}`, {
      isActive: false,
    });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({
      detail: 'Despublique o espaço antes de deixá-lo incompleto',
      errors: { fields: ['Cadastre ao menos uma quadra ativa'] },
    });
    const read = fieldSchema.parse(
      (await api.get(`/api/owner/fields/${field.id}`)).json(),
    );
    expect(read.isActive).toBe(true);
    const v = venueSchema.parse(
      (await api.get(`/api/owner/venues/${venue.id}`)).json(),
    );
    expect(v.status).toBe('published');
  });

  it('excluir a última quadra ativa de um espaço publicado → 422 e nada muda', async () => {
    const { api, venue, field } = await publishedVenue();
    const res = await api.del(`/api/owner/fields/${field.id}`);
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).detail).toBe(
      'Despublique o espaço antes de deixá-lo incompleto',
    );
    expect((await api.get(`/api/owner/fields/${field.id}`)).statusCode).toBe(
      200,
    );
    const v = venueSchema.parse(
      (await api.get(`/api/owner/venues/${venue.id}`)).json(),
    );
    expect(v.fields).toHaveLength(1);
  });

  it('com outra quadra ativa, desativar e excluir passam; só inativa não conta', async () => {
    const { api, venue, field } = await publishedVenue();
    const second = await newField(api, venue.id);
    const off = await api.patch(`/api/owner/fields/${field.id}`, {
      isActive: false,
    });
    expect(off.statusCode).toBe(200);
    expect(fieldSchema.parse(off.json()).isActive).toBe(false);

    // `second` is now the last active field.
    expect(
      (await api.patch(`/api/owner/fields/${second.id}`, { isActive: false }))
        .statusCode,
    ).toBe(422);
    expect((await api.del(`/api/owner/fields/${second.id}`)).statusCode).toBe(
      422,
    );
    // The inactive one can go: it never counted.
    expect((await api.del(`/api/owner/fields/${field.id}`)).statusCode).toBe(
      204,
    );
  });

  it('espaço em rascunho pode desativar e excluir qualquer quadra', async () => {
    const { api, field } = await setup();
    expect(
      (await api.patch(`/api/owner/fields/${field.id}`, { isActive: false }))
        .statusCode,
    ).toBe(200);
    expect((await api.del(`/api/owner/fields/${field.id}`)).statusCode).toBe(
      204,
    );
  });
});
