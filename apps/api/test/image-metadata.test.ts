import { describe, expect, it } from 'vitest';
import { hasExifMetadata } from '../src/photos/image-metadata.js';
import { makePng } from './helpers.js';

const EXIF = Buffer.from('Exif\0\0', 'latin1');

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

const SOI = Buffer.from([0xff, 0xd8]);
const JFIF = jpegSegment(
  0xe0,
  Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1'),
);
const SOS = Buffer.concat([
  jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
  Buffer.from([0x12, 0x34, 0xff, 0xd9]),
]);

function jpeg(...segments: Buffer[]): Buffer {
  return Buffer.concat([SOI, ...segments, SOS]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([
    length,
    Buffer.from(type, 'latin1'),
    data,
    Buffer.alloc(4),
  ]);
}

/** A PNG with an extra chunk right after IHDR. */
function pngWith(type: string, data: Buffer): Buffer {
  const base = makePng();
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([
    base.subarray(0, ihdrEnd),
    pngChunk(type, data),
    base.subarray(ihdrEnd),
  ]);
}

function riffChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type, 0, 'latin1');
  header.writeUInt32LE(data.length, 4);
  return Buffer.concat([
    header,
    data,
    data.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
}

function webp(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), ...chunks]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

describe('hasExifMetadata', () => {
  describe('JPEG', () => {
    it('detects an APP1 segment that starts with Exif', () => {
      const exif = jpegSegment(
        0xe1,
        Buffer.concat([EXIF, Buffer.from('gps-bytes')]),
      );
      expect(hasExifMetadata(jpeg(JFIF, exif), 'image/jpeg')).toBe(true);
    });

    it('accepts a JPEG with no APP1 segment', () => {
      expect(hasExifMetadata(jpeg(JFIF), 'image/jpeg')).toBe(false);
    });

    it('ignores an APP1 segment that is not Exif (XMP)', () => {
      const xmp = jpegSegment(
        0xe1,
        Buffer.from('http://ns.adobe.com/xap/1.0/\0<x/>', 'latin1'),
      );
      expect(hasExifMetadata(jpeg(JFIF, xmp), 'image/jpeg')).toBe(false);
    });

    it('does not grep: the text "Exif" inside another segment is fine', () => {
      const comment = jpegSegment(
        0xfe,
        Buffer.concat([Buffer.from('x'), EXIF]),
      );
      expect(hasExifMetadata(jpeg(JFIF, comment), 'image/jpeg')).toBe(false);
    });

    it('does not read past the start of the scan', () => {
      const late = jpegSegment(0xe1, Buffer.concat([EXIF, Buffer.from('x')]));
      expect(
        hasExifMetadata(Buffer.concat([SOI, JFIF, SOS, late]), 'image/jpeg'),
      ).toBe(false);
    });

    it('detects an Exif segment cut short by the end of the head', () => {
      const exif = jpegSegment(0xe1, Buffer.concat([EXIF, Buffer.alloc(500)]));
      const truncated = Buffer.concat([SOI, JFIF, exif]).subarray(0, 60);
      expect(hasExifMetadata(truncated, 'image/jpeg')).toBe(true);
    });

    it('survives fill bytes and garbage', () => {
      expect(hasExifMetadata(Buffer.from([0xff, 0xd8]), 'image/jpeg')).toBe(
        false,
      );
      expect(hasExifMetadata(Buffer.from('not a jpeg'), 'image/jpeg')).toBe(
        false,
      );
      const exif = jpegSegment(0xe1, EXIF);
      const filled = Buffer.concat([SOI, Buffer.from([0xff, 0xff]), exif]);
      expect(hasExifMetadata(filled, 'image/jpeg')).toBe(true);
    });
  });

  describe('PNG', () => {
    it('detects an eXIf chunk', () => {
      expect(
        hasExifMetadata(pngWith('eXIf', Buffer.from('MM\0*')), 'image/png'),
      ).toBe(true);
    });

    it('accepts a PNG without eXIf', () => {
      expect(hasExifMetadata(makePng(), 'image/png')).toBe(false);
      expect(
        hasExifMetadata(pngWith('tEXt', Buffer.from('a\0eXIf')), 'image/png'),
      ).toBe(false);
    });

    it('survives a truncated chunk', () => {
      expect(hasExifMetadata(makePng().subarray(0, 20), 'image/png')).toBe(
        false,
      );
    });
  });

  describe('WebP', () => {
    const vp8 = riffChunk('VP8 ', Buffer.alloc(11));

    it('detects an EXIF chunk', () => {
      const exif = riffChunk('EXIF', Buffer.from('MM\0*x'));
      expect(hasExifMetadata(webp(vp8, exif), 'image/webp')).toBe(true);
    });

    it('accepts a WebP without EXIF', () => {
      const xmp = riffChunk('XMP ', Buffer.from('<x/>'));
      expect(hasExifMetadata(webp(vp8), 'image/webp')).toBe(false);
      expect(hasExifMetadata(webp(vp8, xmp), 'image/webp')).toBe(false);
    });

    it('rejects nothing that is not RIFF/WEBP', () => {
      expect(hasExifMetadata(Buffer.from('RIFFxxxxWAVE'), 'image/webp')).toBe(
        false,
      );
    });
  });
});
