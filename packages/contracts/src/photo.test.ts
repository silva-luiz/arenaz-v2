import { describe, expect, it } from 'vitest';
import {
  PHOTO_CONTENT_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_VENUE,
  photoConfirmSchema,
  photoOrderSchema,
  photoSchema,
  photoUploadRequestSchema,
  photoUploadResponseSchema,
} from './photo.js';

const ID = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';

describe('photo contracts', () => {
  it('expõe limites', () => {
    expect(PHOTO_CONTENT_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(PHOTO_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(PHOTO_MAX_PER_VENUE).toBe(20);
  });

  it('valida pedido de upload', () => {
    const ok = (contentType: string, size: number) =>
      photoUploadRequestSchema.safeParse({ contentType, size }).success;
    expect(ok('image/png', 1024)).toBe(true);
    expect(ok('image/gif', 1024)).toBe(false);
    expect(ok('image/png', 0)).toBe(false);
    expect(ok('image/png', PHOTO_MAX_BYTES)).toBe(true);
    expect(ok('image/png', PHOTO_MAX_BYTES + 1)).toBe(false);
    expect(ok('image/png', 10.5)).toBe(false);
  });

  it('valida resposta de upload, confirmação, ordem e foto', () => {
    expect(
      photoUploadResponseSchema.safeParse({
        url: 'http://localhost:9000/arenaz',
        fields: { key: 'a', 'Content-Type': 'image/png' },
        key: 'venues/x/a.png',
        expiresAt: '2026-11-01T13:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      photoConfirmSchema.safeParse({ key: 'venues/x/a.png' }).success,
    ).toBe(true);
    expect(photoConfirmSchema.safeParse({ key: '' }).success).toBe(false);
    expect(photoOrderSchema.safeParse({ photoIds: [ID] }).success).toBe(true);
    expect(photoOrderSchema.safeParse({ photoIds: ['nope'] }).success).toBe(
      false,
    );
    expect(
      photoSchema.safeParse({
        id: ID,
        url: 'https://cdn.example.com/a.png',
        srcSet: null,
        position: 0,
      }).success,
    ).toBe(true);
    expect(
      photoSchema.safeParse({
        id: ID,
        url: 'https://cdn.example.com/a.png',
        srcSet: 'https://cdn.example.com/a.w400.webp 400w',
        position: 0,
      }).success,
    ).toBe(true);
    // The variants are part of the contract: a response without them is a bug.
    expect(
      photoSchema.safeParse({
        id: ID,
        url: 'https://cdn.example.com/a.png',
        position: 0,
      }).success,
    ).toBe(false);
  });
});
