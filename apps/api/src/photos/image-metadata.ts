/**
 * Detects EXIF metadata (which can carry the exact GPS position of a photo)
 * in the first bytes of an image. Only the container structure is walked:
 * segments (JPEG), chunks (PNG) and RIFF chunks (WebP). Nothing is grepped.
 *
 * Limit: only the bytes given are inspected. A PNG `eXIf` chunk placed after
 * the first chunks of image data can sit beyond a short head; the web client
 * re-encodes every photo, so this is a server-side backstop.
 */

export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function matchesAt(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let index = 0; index < length; index += 1) {
    const value = bytes[offset + index];
    if (value === undefined) return '';
    text += String.fromCharCode(value);
  }
  return text;
}

function hasJpegExif(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return false;
    const marker = bytes[offset + 1];
    if (marker === undefined) return false;
    if (marker === 0xff) {
      // Fill byte before a marker.
      offset += 1;
      continue;
    }
    // Standalone markers (no length): TEM, RSTn, SOI.
    if (
      marker === 0x01 ||
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    // EOI, or SOS: the image data starts and no metadata follows.
    if (marker === 0xd9 || marker === 0xda) return false;

    const high = bytes[offset + 2];
    const low = bytes[offset + 3];
    if (high === undefined || low === undefined) return false;
    const length = (high << 8) | low;
    if (length < 2) return false;
    if (marker === 0xe1 && matchesAt(bytes, offset + 4, EXIF_HEADER)) {
      return true;
    }
    offset += 2 + length;
  }
  return false;
}

function hasPngExif(bytes: Uint8Array): boolean {
  if (!matchesAt(bytes, 0, PNG_SIGNATURE)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = asciiAt(bytes, offset + 4, 4);
    if (type === 'eXIf') return true;
    if (type === 'IEND') return false;
    // length + type + data + crc
    offset += 12 + length;
  }
  return false;
}

function hasWebpExif(bytes: Uint8Array): boolean {
  if (asciiAt(bytes, 0, 4) !== 'RIFF' || asciiAt(bytes, 8, 4) !== 'WEBP') {
    return false;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = asciiAt(bytes, offset, 4);
    if (type === 'EXIF') return true;
    const size = view.getUint32(offset + 4, true);
    // Chunks are padded to an even size.
    offset += 8 + size + (size % 2);
  }
  return false;
}

/** True when `head` (the first bytes of the file) carries an EXIF block. */
export function hasExifMetadata(
  head: Uint8Array,
  contentType: PhotoMime,
): boolean {
  switch (contentType) {
    case 'image/jpeg':
      return hasJpegExif(head);
    case 'image/png':
      return hasPngExif(head);
    case 'image/webp':
      return hasWebpExif(head);
  }
}
