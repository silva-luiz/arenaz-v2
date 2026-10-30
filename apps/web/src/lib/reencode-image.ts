import { PHOTO_MAX_BYTES } from '@arenaz/contracts';

/** The longest side of a re-encoded photo, in pixels. */
export const MAX_SIDE = 2560;
const QUALITY = 0.9;

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number | undefined,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

/**
 * Draws the image on a canvas and encodes it again, which drops every piece of
 * metadata (EXIF, with the exact GPS position) because the canvas keeps only
 * pixels. The EXIF orientation is applied while decoding, so the picture stays
 * upright. The type is kept (a lossless PNG stays PNG; JPEG and WebP use
 * quality 0.9) and the longest side is capped at 2560 px.
 *
 * Rejects when the image cannot be decoded or the browser cannot encode that
 * type; the caller must not upload the original in that case.
 */
export async function reencodeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas indisponível');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const lossy = file.type === 'image/jpeg' || file.type === 'image/webp';
    const blob = await encode(canvas, file.type, lossy ? QUALITY : undefined);
    // A browser that cannot encode the type silently answers with a PNG.
    if (!blob || blob.type !== file.type) {
      throw new Error('não foi possível recodificar a imagem');
    }
    if (blob.size < 1 || blob.size > PHOTO_MAX_BYTES) {
      throw new Error('tamanho inválido após recodificar');
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
