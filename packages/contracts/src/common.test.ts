import { describe, expect, it } from 'vitest';
import { centsSchema, phoneBrSchema } from './common.js';

describe('common schemas', () => {
  it.each(['(11) 98765-4321', '11987654321', '+5511987654321'])(
    'normaliza telefone %s',
    (raw) => {
      expect(phoneBrSchema.parse(raw)).toBe('+5511987654321');
    },
  );

  it.each(['1234', '(11) 8765-432', '+1 415 555 0100'])(
    'rejeita telefone %s',
    (raw) => {
      expect(phoneBrSchema.safeParse(raw).success).toBe(false);
    },
  );

  it('rejeita centavos fracionados e negativos', () => {
    expect(centsSchema.safeParse(10.5).success).toBe(false);
    expect(centsSchema.safeParse(-1).success).toBe(false);
  });
});
