import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { S3Storage } from '../src/storage/s3.storage.js';
import type { UploadPost } from '../src/storage/storage.port.js';
import { makePng, testEnv } from './helpers.js';

/**
 * Talks to the real MinIO started by test/minio-setup.ts.
 *
 * "The storage refuses a file bigger than the limit": the API always signs
 * policies for 1..PHOTO_MAX_BYTES (10 MB), and uploading 10 MB just to see the
 * refusal would be slow and wasteful. The policy logic is the same for any
 * limit, so these tests sign with a tiny `maxBytes` and post a few bytes more.
 */
const storage = new S3Storage(testEnv);
const png = makePng();

afterAll(() => {
  storage.destroy();
});

const newKey = (ext = 'png'): string => `test-storage/${randomUUID()}.${ext}`;

async function post(
  upload: UploadPost,
  bytes: Uint8Array,
  contentType: string,
  override: Record<string, string> = {},
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries({
    ...upload.fields,
    ...override,
  })) {
    form.append(name, value);
  }
  form.append('file', new Blob([bytes], { type: contentType }));
  return fetch(upload.url, { method: 'POST', body: form });
}

describe('S3Storage against MinIO', () => {
  it('aceita arquivo dentro do limite e o expõe por URL pública', async () => {
    const key = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 1000);
    expect(upload.fields['key']).toBe(key);
    expect(upload.fields['Content-Type']).toBe('image/png');
    expect(upload.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      10 * 60_000,
    );

    const res = await post(upload, png, 'image/png');
    expect(res.ok).toBe(true);
    expect(await storage.head(key)).toEqual({
      size: png.length,
      contentType: 'image/png',
    });
    const served = await fetch(storage.publicUrl(key));
    expect(served.status).toBe(200);
  });

  it('recusa arquivo maior que o limite assinado (4xx do storage)', async () => {
    const key = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 100);
    const res = await post(upload, new Uint8Array(101), 'image/png');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await res.text()).toContain('EntityTooLarge');
    expect(await storage.head(key)).toBeNull();
  });

  it('o limite exato ainda passa', async () => {
    const key = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 100);
    const res = await post(upload, new Uint8Array(100), 'image/png');
    expect(res.ok).toBe(true);
  });

  it('recusa arquivo vazio', async () => {
    const key = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 100);
    const res = await post(upload, new Uint8Array(0), 'image/png');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await storage.head(key)).toBeNull();
  });

  it('recusa Content-Type diferente do assinado', async () => {
    const key = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 1000);
    const res = await post(upload, png, 'image/gif', {
      'Content-Type': 'image/gif',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await storage.head(key)).toBeNull();
  });

  it('recusa chave diferente da assinada', async () => {
    const key = newKey();
    const other = newKey();
    const upload = await storage.createUploadPost(key, 'image/png', 1000);
    const res = await post(upload, png, 'image/png', { key: other });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await storage.head(other)).toBeNull();
    expect(await storage.head(key)).toBeNull();
  });

  it('head devolve null para objeto inexistente', async () => {
    expect(await storage.head(newKey())).toBeNull();
  });

  it('delete remove vários objetos e ignora os que não existem', async () => {
    const keys = [newKey(), newKey()];
    for (const key of keys) {
      const upload = await storage.createUploadPost(key, 'image/png', 1000);
      expect((await post(upload, png, 'image/png')).ok).toBe(true);
    }
    await storage.delete([...keys, newKey()]);
    for (const key of keys) expect(await storage.head(key)).toBeNull();
    await expect(storage.delete([])).resolves.toBeUndefined();
  });

  it('publicUrl junta a base pública e a chave', () => {
    expect(storage.publicUrl('venues/a/b.png')).toBe(
      `${testEnv.S3_PUBLIC_URL}/venues/a/b.png`,
    );
    const trailing = new S3Storage({
      ...testEnv,
      S3_PUBLIC_URL: `${testEnv.S3_PUBLIC_URL}/`,
    });
    expect(trailing.publicUrl('k.png')).toBe(`${testEnv.S3_PUBLIC_URL}/k.png`);
    trailing.destroy();
  });
});
