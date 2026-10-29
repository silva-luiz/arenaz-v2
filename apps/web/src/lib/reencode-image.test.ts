import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reencodeImage } from './reencode-image';

const close = vi.fn();
const drawImage = vi.fn();
const toBlob = vi.fn();
const createImageBitmap = vi.fn();
let canvases: HTMLCanvasElement[] = [];

function reencoded(type: string, bytes = 7): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

describe('reencodeImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canvases = [];
    createImageBitmap.mockResolvedValue({ width: 800, height: 600, close });
    toBlob.mockImplementation((callback: BlobCallback, type?: string) => {
      callback(reencoded(type ?? 'image/png'));
    });
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        canvases.push(this);
        return { drawImage } as unknown as CanvasRenderingContext2D;
      } as never,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      toBlob as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['image/jpeg', 0.9],
    ['image/webp', 0.9],
    ['image/png', undefined],
  ])('keeps the type: %s', async (type, quality) => {
    const file = new File([new Uint8Array(100)], 'foto', { type });

    const blob = await reencodeImage(file);

    expect(blob.type).toBe(type);
    expect(blob).not.toBe(file);
    expect(blob.size).toBe(7);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), type, quality);
  });

  it('applies the EXIF orientation when decoding and releases the bitmap', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

    await reencodeImage(file);

    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: 'from-image',
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps the size when it is within 2560px', async () => {
    createImageBitmap.mockResolvedValue({ width: 2560, height: 1000, close });

    await reencodeImage(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(canvases[0]?.width).toBe(2560);
    expect(canvases[0]?.height).toBe(1000);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2560, 1000);
  });

  it('caps the longest side at 2560px, keeping the proportion', async () => {
    createImageBitmap.mockResolvedValue({ width: 5120, height: 2880, close });

    await reencodeImage(new File(['x'], 'a.png', { type: 'image/png' }));

    expect(canvases[0]?.width).toBe(2560);
    expect(canvases[0]?.height).toBe(1440);
  });

  it('fails when the image cannot be decoded', async () => {
    createImageBitmap.mockRejectedValue(new Error('bad image'));

    await expect(
      reencodeImage(new File(['x'], 'a.png', { type: 'image/png' })),
    ).rejects.toThrow();
  });

  it('fails when the browser cannot encode the type (falls back to PNG)', async () => {
    toBlob.mockImplementation((callback: BlobCallback) => {
      callback(reencoded('image/png'));
    });

    await expect(
      reencodeImage(new File(['x'], 'a.webp', { type: 'image/webp' })),
    ).rejects.toThrow();
    expect(close).toHaveBeenCalled();
  });

  it('fails when encoding returns nothing', async () => {
    toBlob.mockImplementation((callback: BlobCallback) => {
      callback(null);
    });

    await expect(
      reencodeImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow();
  });
});
