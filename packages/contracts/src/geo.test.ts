import { describe, expect, it } from 'vitest';
import {
  addressResponseSchema,
  addressSchema,
  cepLookupResponseSchema,
  cepSchema,
  locationSchema,
  minuteOfDaySchema,
} from './geo.js';

describe('cepSchema', () => {
  it.each(['01310-100', '01310100', ' 01.310-100 '])('normaliza %s', (raw) => {
    expect(cepSchema.parse(raw)).toBe('01310100');
  });

  it.each(['1234567', '123456789', 'abc', ''])('rejeita %s', (raw) => {
    const r = cepSchema.safeParse(raw);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('CEP inválido');
  });

  it('rejeita valores que não são texto', () => {
    const r = cepSchema.safeParse(1310100);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('CEP inválido');
  });
});

describe('minuteOfDaySchema', () => {
  it.each([0, 30, 1080, 1440])('aceita %i', (v) => {
    expect(minuteOfDaySchema.safeParse(v).success).toBe(true);
  });

  it.each([1085, -30, 1470, 10.5, 15])('rejeita %s', (v) => {
    const r = minuteOfDaySchema.safeParse(v);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(
      'Use horários em intervalos de 30 minutos',
    );
  });
});

describe('locationSchema', () => {
  it('aceita São Paulo e rejeita fora do Brasil', () => {
    expect(locationSchema.safeParse({ lat: -23.56, lng: -46.65 }).success).toBe(
      true,
    );
    const r = locationSchema.safeParse({ lat: 40, lng: -46.65 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Localização fora do Brasil');
    expect(locationSchema.safeParse({ lat: -23, lng: 10 }).success).toBe(false);
  });
});

describe('addressSchema', () => {
  const base = {
    cep: '01310-100',
    street: 'Avenida Paulista',
    number: '1000',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  };

  it('normaliza o CEP e deixa o complemento opcional', () => {
    const r = addressSchema.parse(base);
    expect(r.cep).toBe('01310100');
    expect(r.complement).toBeUndefined();
  });

  it('rejeita UF desconhecida', () => {
    expect(addressSchema.safeParse({ ...base, state: 'XX' }).success).toBe(
      false,
    );
  });

  it('a resposta traz complemento nulo', () => {
    const r = addressResponseSchema.parse({
      ...base,
      cep: '01310100',
      complement: null,
    });
    expect(r.complement).toBeNull();
  });
});

describe('cepLookupResponseSchema', () => {
  const base = {
    cep: '01310100',
    street: 'Avenida Paulista',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
  };

  it('aceita location nula ou preenchida', () => {
    expect(
      cepLookupResponseSchema.safeParse({ ...base, location: null }).success,
    ).toBe(true);
    expect(
      cepLookupResponseSchema.safeParse({
        ...base,
        location: { lat: -23.56, lng: -46.65 },
      }).success,
    ).toBe(true);
  });
});
