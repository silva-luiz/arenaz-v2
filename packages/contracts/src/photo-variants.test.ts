import { describe, expect, it } from 'vitest';
import {
  PHOTO_VARIANT_WIDTHS,
  buildSrcSet,
  photoVariantKey,
} from './photo-variants.js';

describe('photo variants', () => {
  it('has three ascending widths', () => {
    expect(PHOTO_VARIANT_WIDTHS).toEqual([400, 800, 1600]);
  });

  it('replaces the extension with .w{width}.webp', () => {
    expect(photoVariantKey('venues/a/b.jpg', 400)).toBe('venues/a/b.w400.webp');
    expect(photoVariantKey('venues/a/b.png', 800)).toBe('venues/a/b.w800.webp');
    expect(photoVariantKey('venues/a/b.webp', 1600)).toBe(
      'venues/a/b.w1600.webp',
    );
  });

  it('only touches the last extension of the file name', () => {
    expect(photoVariantKey('venues/a.b/c.d.jpg', 400)).toBe(
      'venues/a.b/c.d.w400.webp',
    );
    expect(photoVariantKey('venues/a.b/c', 400)).toBe('venues/a.b/c.w400.webp');
  });

  it('builds a srcset from the produced widths, or null when there are none', () => {
    const url = (key: string) => `https://cdn.example.com/${key}`;
    expect(buildSrcSet('venues/a/b.jpg', [400, 800], url)).toBe(
      'https://cdn.example.com/venues/a/b.w400.webp 400w, https://cdn.example.com/venues/a/b.w800.webp 800w',
    );
    expect(buildSrcSet('venues/a/b.jpg', null, url)).toBeNull();
    expect(buildSrcSet('venues/a/b.jpg', [], url)).toBeNull();
  });
});
