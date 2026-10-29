import { randomUUID } from 'node:crypto';
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_VENUE,
  photoSchema,
  photoUploadResponseSchema,
  venueSchema,
  venueSummarySchema,
  type Photo,
  type PhotoUploadResponse,
  type Problem,
  type Venue,
} from '@arenaz/contracts';
import { schema } from '@arenaz/db';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { asc, eq } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DB, type DbHandle } from '../src/db/db.module.js';
import { STORAGE, type StoragePort } from '../src/storage/storage.port.js';
import {
  asUser,
  buildTestApp,
  makePng,
  signUpAs,
  testEnv,
  uniqueToken,
  venueBody,
  type AsUser,
} from './helpers.js';

let app: NestFastifyApplication;
let handle: DbHandle;
let storage: StoragePort;
// Writes objects straight into the bucket, like a (possibly hostile) browser.
const s3 = new S3Client({
  endpoint: testEnv.S3_ENDPOINT,
  region: testEnv.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: testEnv.S3_ACCESS_KEY_ID,
    secretAccessKey: testEnv.S3_SECRET_ACCESS_KEY,
  },
});

const png = makePng();

beforeAll(async () => {
  app = await buildTestApp();
  handle = app.get<DbHandle>(DB);
  storage = app.get<StoragePort>(STORAGE);
});

afterAll(async () => {
  await app.close();
  s3.destroy();
});

async function newOwner(name = 'Dono') {
  const { cookie, userId } = await signUpAs(app, name);
  return { userId, api: asUser(app, cookie) };
}

const problemOf = (res: LightMyRequestResponse): Problem => res.json<Problem>();

async function newVenue(api: AsUser): Promise<Venue> {
  const res = await api.post('/api/owner/venues', venueBody());
  expect(res.statusCode).toBe(201);
  return venueSchema.parse(res.json());
}

const photosUrl = (venueId: string, suffix = ''): string =>
  `/api/owner/venues/${venueId}/photos${suffix}`;

async function requestUpload(
  api: AsUser,
  venueId: string,
  contentType = 'image/png',
  size = png.length,
): Promise<PhotoUploadResponse> {
  const res = await api.post(photosUrl(venueId, '/upload-url'), {
    contentType,
    size,
  });
  expect(res.statusCode).toBe(201);
  return photoUploadResponseSchema.parse(res.json());
}

/** The browser's half: POST the file straight to the storage. */
async function uploadToStorage(
  upload: PhotoUploadResponse,
  bytes: Buffer,
  contentType: string,
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value);
  }
  form.append('file', new Blob([new Uint8Array(bytes)], { type: contentType }));
  return fetch(upload.url, { method: 'POST', body: form });
}

/** Full happy path: upload-url, direct upload, confirmation. */
async function addPhoto(api: AsUser, venueId: string): Promise<Photo> {
  const upload = await requestUpload(api, venueId);
  const stored = await uploadToStorage(upload, png, 'image/png');
  expect(stored.ok).toBe(true);
  const res = await api.post(photosUrl(venueId), { key: upload.key });
  expect(res.statusCode).toBe(201);
  return photoSchema.parse(res.json());
}

/** Puts an object in the bucket with any content type/size, bypassing policy. */
async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: testEnv.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

async function photoRows(venueId: string) {
  return handle.db
    .select()
    .from(schema.venuePhoto)
    .where(eq(schema.venuePhoto.venueId, venueId))
    .orderBy(asc(schema.venuePhoto.position));
}

/** Fills a venue with `count` photo rows (no storage objects). */
async function seedPhotoRows(venueId: string, count: number): Promise<void> {
  if (count === 0) return;
  await handle.db.insert(schema.venuePhoto).values(
    Array.from({ length: count }, (_, position) => ({
      venueId,
      storageKey: `venues/${venueId}/${randomUUID()}.jpg`,
      position,
    })),
  );
}

async function venueOf(api: AsUser, venueId: string): Promise<Venue> {
  const res = await api.get(`/api/owner/venues/${venueId}`);
  expect(res.statusCode).toBe(200);
  return venueSchema.parse(res.json());
}

const HOURS = [{ weekday: 1, openMinute: 480, closeMinute: 1320 }];

/** Hours + one active field: only the photo is missing to publish. */
async function addHoursAndField(api: AsUser, venueId: string): Promise<void> {
  expect(
    (await api.put(`/api/owner/venues/${venueId}/hours`, HOURS)).statusCode,
  ).toBe(200);
  const field = await api.post(`/api/owner/venues/${venueId}/fields`, {
    name: `Quadra ${uniqueToken()}`,
    sports: ['futsal'],
    surface: 'piso_rigido',
    format: null,
    minSlotMinutes: 60,
    basePriceCentsPerHour: 8000,
    isActive: true,
  });
  expect(field.statusCode).toBe(201);
}

describe('venue photos e2e', () => {
  it('upload direto + confirmação cria a foto', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);

    const upload = await requestUpload(api, venue.id);
    expect(upload.key).toMatch(
      new RegExp(`^venues/${venue.id}/[0-9a-f-]{36}\\.png$`),
    );
    expect(upload.fields['Content-Type']).toBe('image/png');
    const ttl = new Date(upload.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);

    const stored = await uploadToStorage(upload, png, 'image/png');
    expect(stored.ok).toBe(true);

    const res = await api.post(photosUrl(venue.id), { key: upload.key });
    expect(res.statusCode).toBe(201);
    const photo = photoSchema.parse(res.json());
    expect(photo.position).toBe(0);
    expect(photo.url).toBe(`${testEnv.S3_PUBLIC_URL}/${upload.key}`);

    // The public URL serves the very bytes that were uploaded, anonymously.
    const served = await fetch(photo.url);
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer()).equals(png)).toBe(true);

    expect((await venueOf(api, venue.id)).photos).toEqual([photo]);
  });

  it('as fotos entram na última posição e o resumo usa a primeira como capa', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const first = await addPhoto(api, venue.id);
    const second = await addPhoto(api, venue.id);
    expect([first.position, second.position]).toEqual([0, 1]);

    const list = await api.get('/api/owner/venues');
    const summary = venueSummarySchema
      .array()
      .parse(list.json())
      .find((item) => item.id === venue.id);
    expect(summary?.coverUrl).toBe(first.url);
  });

  it.each([
    ['fora do prefixo', () => 'venues/outro-id/x.png'],
    ['de outro espaço', () => `venues/${randomUUID()}/${randomUUID()}.png`],
    [
      'com path traversal',
      (id: string) => `venues/${id}/../x/${randomUUID()}.png`,
    ],
    [
      'com extensão não permitida',
      (id: string) => `venues/${id}/${randomUUID()}.gif`,
    ],
    ['com nome fora do formato', (id: string) => `venues/${id}/foto.png`],
    ['inexistente', (id: string) => `venues/${id}/${randomUUID()}.png`],
  ])('confirmação %s → 422 e nenhuma foto criada', async (_name, makeKey) => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const res = await api.post(photosUrl(venue.id), {
      key: makeKey(venue.id),
    });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).detail).toBe('Arquivo de foto inválido');
    expect((await venueOf(api, venue.id)).photos).toEqual([]);
    expect(await photoRows(venue.id)).toEqual([]);
  });

  it('chave fora do padrão é recusada sem consultar o storage', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const head = vi.spyOn(storage, 'head');
    try {
      const res = await api.post(photosUrl(venue.id), {
        key: 'venues/outro-id/x.png',
      });
      expect(res.statusCode).toBe(422);
      expect(head).not.toHaveBeenCalled();
    } finally {
      head.mockRestore();
    }
  });

  it.each([
    ['tipo fora da lista', 'image/gif', png],
    ['tipo diferente da extensão', 'image/jpeg', png],
    ['tamanho acima do limite', 'image/png', Buffer.alloc(PHOTO_MAX_BYTES + 1)],
  ])(
    'objeto enviado com %s → 422 e nenhuma foto criada',
    async (_name, contentType, body) => {
      const { api } = await newOwner();
      const venue = await newVenue(api);
      const key = `venues/${venue.id}/${randomUUID()}.png`;
      await putObject(key, body, contentType);

      const res = await api.post(photosUrl(venue.id), { key });
      expect(res.statusCode).toBe(422);
      expect(problemOf(res).detail).toBe('Arquivo de foto inválido');
      expect(await photoRows(venue.id)).toEqual([]);
    },
  );

  it('chave já registrada → 409', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const upload = await requestUpload(api, venue.id);
    await uploadToStorage(upload, png, 'image/png');
    const first = await api.post(photosUrl(venue.id), { key: upload.key });
    expect(first.statusCode).toBe(201);

    const again = await api.post(photosUrl(venue.id), { key: upload.key });
    expect(again.statusCode).toBe(409);
    expect(problemOf(again).detail).toBe('Foto já registrada');
    expect(await photoRows(venue.id)).toHaveLength(1);
  });

  it.each([
    ['tipo não permitido', { contentType: 'image/gif', size: 1000 }],
    ['tamanho zero', { contentType: 'image/png', size: 0 }],
    [
      'tamanho acima do limite',
      { contentType: 'image/png', size: PHOTO_MAX_BYTES + 1 },
    ],
  ])('pedido de URL com %s → 422', async (_name, body) => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const res = await api.post(photosUrl(venue.id, '/upload-url'), body);
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors).toBeDefined();
  });

  it('limite de 20 fotos por espaço no pedido de URL', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await seedPhotoRows(venue.id, PHOTO_MAX_PER_VENUE);
    const res = await api.post(photosUrl(venue.id, '/upload-url'), {
      contentType: 'image/png',
      size: png.length,
    });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).detail).toBe('Limite de 20 fotos por espaço');
  });

  it('o limite vale também na confirmação (URLs pedidas antes de chegar ao limite)', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await seedPhotoRows(venue.id, PHOTO_MAX_PER_VENUE - 1);
    const a = await requestUpload(api, venue.id);
    const b = await requestUpload(api, venue.id);
    await uploadToStorage(a, png, 'image/png');
    await uploadToStorage(b, png, 'image/png');

    const accepted = await api.post(photosUrl(venue.id), { key: a.key });
    expect(accepted.statusCode).toBe(201);
    const over = await api.post(photosUrl(venue.id), { key: b.key });
    expect(over.statusCode).toBe(422);
    expect(problemOf(over).detail).toBe('Limite de 20 fotos por espaço');
    expect(await photoRows(venue.id)).toHaveLength(PHOTO_MAX_PER_VENUE);
  });

  it('confirmações simultâneas respeitam o limite e usam posições distintas', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await seedPhotoRows(venue.id, PHOTO_MAX_PER_VENUE - 1);
    const a = await requestUpload(api, venue.id);
    const b = await requestUpload(api, venue.id);
    await uploadToStorage(a, png, 'image/png');
    await uploadToStorage(b, png, 'image/png');

    const results = await Promise.all([
      api.post(photosUrl(venue.id), { key: a.key }),
      api.post(photosUrl(venue.id), { key: b.key }),
    ]);
    expect(results.map((res) => res.statusCode).sort()).toEqual([201, 422]);
    const rows = await photoRows(venue.id);
    expect(rows).toHaveLength(PHOTO_MAX_PER_VENUE);
    expect(new Set(rows.map((row) => row.position)).size).toBe(
      PHOTO_MAX_PER_VENUE,
    );
  });

  it('outro dono recebe 404 em upload-url, confirmação, ordem e delete, sem alterar nada', async () => {
    const { api: a } = await newOwner('Dono A');
    const { api: b } = await newOwner('Dono B');
    const venue = await newVenue(a);
    const photo = await addPhoto(a, venue.id);
    const upload = await requestUpload(a, venue.id);
    await uploadToStorage(upload, png, 'image/png');

    const attempts = await Promise.all([
      b.post(photosUrl(venue.id, '/upload-url'), {
        contentType: 'image/png',
        size: png.length,
      }),
      b.post(photosUrl(venue.id), { key: upload.key }),
      b.put(photosUrl(venue.id, '/order'), { photoIds: [photo.id] }),
      b.del(photosUrl(venue.id, `/${photo.id}`)),
    ]);
    for (const res of attempts) {
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    expect((await venueOf(a, venue.id)).photos).toEqual([photo]);
    expect(await storage.head(upload.key)).not.toBeNull();
  });

  it('corpo inválido é 422 mesmo em espaço de outro dono (sem vazar existência)', async () => {
    const { api: a } = await newOwner('Dono A');
    const { api: b } = await newOwner('Dono B');
    const venue = await newVenue(a);
    const res = await b.post(photosUrl(venue.id, '/upload-url'), {
      contentType: 'image/gif',
      size: 10,
    });
    expect(res.statusCode).toBe(422);
  });

  it('espaço inexistente ou id malformado → 404', async () => {
    const { api } = await newOwner();
    for (const id of [randomUUID(), 'nao-e-uuid']) {
      const res = await api.post(photosUrl(id, '/upload-url'), {
        contentType: 'image/png',
        size: 10,
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('reordena exatamente as fotos do espaço', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const p0 = await addPhoto(api, venue.id);
    const p1 = await addPhoto(api, venue.id);
    const p2 = await addPhoto(api, venue.id);

    const res = await api.put(photosUrl(venue.id, '/order'), {
      photoIds: [p2.id, p0.id, p1.id],
    });
    expect(res.statusCode).toBe(200);
    const ordered = photoSchema.array().parse(res.json());
    expect(ordered.map((photo) => [photo.id, photo.position])).toEqual([
      [p2.id, 0],
      [p0.id, 1],
      [p1.id, 2],
    ]);
    const stored = (await venueOf(api, venue.id)).photos;
    expect(stored.map((photo) => photo.id)).toEqual([p2.id, p0.id, p1.id]);
  });

  it('ordem incompleta, repetida ou com id alheio → 422 e nada muda', async () => {
    const { api } = await newOwner();
    const other = await newOwner();
    const venue = await newVenue(api);
    const otherVenue = await newVenue(other.api);
    const foreign = await addPhoto(other.api, otherVenue.id);
    const p0 = await addPhoto(api, venue.id);
    const p1 = await addPhoto(api, venue.id);

    const bodies = [
      { photoIds: [p1.id] }, // one missing
      { photoIds: [] }, // all missing
      { photoIds: [p1.id, p1.id] }, // repeated, one missing
      { photoIds: [p1.id, p0.id, p0.id] }, // one repeated
      { photoIds: [p1.id, foreign.id] }, // someone else's photo
      { photoIds: [p1.id, p0.id, foreign.id] }, // extra foreign photo
      { photoIds: [p1.id, randomUUID()] }, // unknown id
    ];
    for (const body of bodies) {
      const res = await api.put(photosUrl(venue.id, '/order'), body);
      expect(res.statusCode).toBe(422);
      expect(problemOf(res).detail).toBe(
        'Envie a lista completa de fotos do espaço',
      );
    }
    const stored = (await venueOf(api, venue.id)).photos;
    expect(stored.map((photo) => photo.id)).toEqual([p0.id, p1.id]);
    expect(await photoRows(otherVenue.id)).toHaveLength(1);
  });

  it('ordem com id que não é uuid → 422 de validação', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const res = await api.put(photosUrl(venue.id, '/order'), {
      photoIds: ['nope'],
    });
    expect(res.statusCode).toBe(422);
  });

  it('apagar a foto remove o objeto e reordena as posições', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const p0 = await addPhoto(api, venue.id);
    const p1 = await addPhoto(api, venue.id);
    const p2 = await addPhoto(api, venue.id);
    const key1 = (await photoRows(venue.id))[1]?.storageKey ?? '';
    expect(await storage.head(key1)).not.toBeNull();

    const res = await api.del(photosUrl(venue.id, `/${p1.id}`));
    expect(res.statusCode).toBe(204);

    const photos = (await venueOf(api, venue.id)).photos;
    expect(photos.map((photo) => [photo.id, photo.position])).toEqual([
      [p0.id, 0],
      [p2.id, 1],
    ]);
    expect(await storage.head(key1)).toBeNull();
  });

  it('foto de outro espaço do mesmo dono, inexistente ou malformada → 404', async () => {
    const { api } = await newOwner();
    const venueA = await newVenue(api);
    const venueB = await newVenue(api);
    const photo = await addPhoto(api, venueA.id);

    for (const id of [photo.id, randomUUID(), 'nao-e-uuid']) {
      const res = await api.del(photosUrl(venueB.id, `/${id}`));
      expect(res.statusCode).toBe(404);
    }
    expect((await venueOf(api, venueA.id)).photos).toEqual([photo]);
  });

  it('falha ao apagar o objeto não desfaz a remoção da foto', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    const photo = await addPhoto(api, venue.id);
    const del = vi
      .spyOn(storage, 'delete')
      .mockRejectedValueOnce(new Error('storage fora do ar'));
    try {
      const res = await api.del(photosUrl(venue.id, `/${photo.id}`));
      expect(res.statusCode).toBe(204);
      expect(del).toHaveBeenCalledTimes(1);
    } finally {
      del.mockRestore();
    }
    expect(await photoRows(venue.id)).toEqual([]);
  });

  it('espaço completo publica', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await addHoursAndField(api, venue.id);
    await addPhoto(api, venue.id);

    const res = await api.post(`/api/owner/venues/${venue.id}/publish`);
    expect(res.statusCode).toBe(200);
    const published = venueSchema.parse(res.json());
    expect(published.status).toBe('published');
    expect(published.photos).toHaveLength(1);
  });

  it('apagar a última foto de um espaço publicado → 422 e a foto fica', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await addHoursAndField(api, venue.id);
    const photo = await addPhoto(api, venue.id);
    const publish = await api.post(`/api/owner/venues/${venue.id}/publish`);
    expect(publish.statusCode).toBe(200);
    const key = (await photoRows(venue.id))[0]?.storageKey ?? '';

    const del = vi.spyOn(storage, 'delete');
    try {
      const res = await api.del(photosUrl(venue.id, `/${photo.id}`));
      expect(res.statusCode).toBe(422);
      expect(problemOf(res).detail).toBe(
        'Despublique o espaço antes de deixá-lo incompleto',
      );
      expect(problemOf(res).errors?.['photos']).toBeDefined();
      expect(del).not.toHaveBeenCalled();
    } finally {
      del.mockRestore();
    }
    const after = await venueOf(api, venue.id);
    expect(after.status).toBe('published');
    expect(after.photos).toEqual([photo]);
    expect(await storage.head(key)).not.toBeNull();
  });

  it('em espaço publicado com 2 fotos, apagar uma é permitido', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await addHoursAndField(api, venue.id);
    const first = await addPhoto(api, venue.id);
    const second = await addPhoto(api, venue.id);
    await api.post(`/api/owner/venues/${venue.id}/publish`);

    const res = await api.del(photosUrl(venue.id, `/${first.id}`));
    expect(res.statusCode).toBe(204);
    const after = await venueOf(api, venue.id);
    expect(after.photos.map((photo) => [photo.id, photo.position])).toEqual([
      [second.id, 0],
    ]);
  });

  it('apagar espaço apaga objetos do storage', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await addPhoto(api, venue.id);
    await addPhoto(api, venue.id);
    const keys = (await photoRows(venue.id)).map((row) => row.storageKey);
    expect(keys).toHaveLength(2);
    for (const key of keys) expect(await storage.head(key)).not.toBeNull();

    const res = await api.del(`/api/owner/venues/${venue.id}`);
    expect(res.statusCode).toBe(204);
    for (const key of keys) expect(await storage.head(key)).toBeNull();
    expect(await photoRows(venue.id)).toEqual([]);
  });

  it('falha ao apagar objetos não impede apagar o espaço', async () => {
    const { api } = await newOwner();
    const venue = await newVenue(api);
    await addPhoto(api, venue.id);
    const del = vi
      .spyOn(storage, 'delete')
      .mockRejectedValueOnce(new Error('storage fora do ar'));
    try {
      const res = await api.del(`/api/owner/venues/${venue.id}`);
      expect(res.statusCode).toBe(204);
    } finally {
      del.mockRestore();
    }
    const gone = await api.get(`/api/owner/venues/${venue.id}`);
    expect(gone.statusCode).toBe(404);
  });

  it('rotas de fotos exigem autenticação', async () => {
    const res = await app.inject({
      method: 'POST',
      url: photosUrl(randomUUID(), '/upload-url'),
      payload: { contentType: 'image/png', size: 10 },
    });
    expect(res.statusCode).toBe(401);
  });
});
