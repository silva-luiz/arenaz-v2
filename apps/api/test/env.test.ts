import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const valid = {
  DATABASE_URL: 'postgres://arenaz:arenaz@localhost:5432/arenaz',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  API_PORT: '4000',
  WEB_ORIGIN: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'arenaz-photos',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_PUBLIC_URL: 'http://localhost:9000/arenaz-photos',
  PAYMENT_PROVIDER: 'fake',
  NODE_ENV: 'test',
};

describe('loadEnv', () => {
  it('exige PAYMENT_PROVIDER', () => {
    const rest: Record<string, string | undefined> = { ...valid };
    delete rest.PAYMENT_PROVIDER;
    expect(() => loadEnv(rest)).toThrow(/PAYMENT_PROVIDER/);
  });

  it('rejeita PAYMENT_PROVIDER desconhecido', () => {
    expect(() => loadEnv({ ...valid, PAYMENT_PROVIDER: 'stripe' })).toThrow(
      /PAYMENT_PROVIDER/,
    );
  });

  it('aceita PAYMENT_PROVIDER=fake fora de produção', () => {
    expect(loadEnv(valid).PAYMENT_PROVIDER).toBe('fake');
    expect(
      loadEnv({ ...valid, NODE_ENV: 'development' }).PAYMENT_PROVIDER,
    ).toBe('fake');
  });

  it('recusa PAYMENT_PROVIDER=fake em produção, citando a variável', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /PAYMENT_PROVIDER: não pode ser "fake" com NODE_ENV=production/,
    );
  });

  it('lista variáveis faltando', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it('rejeita secret curto', () => {
    expect(() => loadEnv({ ...valid, BETTER_AUTH_SECRET: 'abc' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it.each(['localhost:5432', 'not a url', 'http://localhost:5432'])(
    'rejeita DATABASE_URL inválida (%s)',
    (value) => {
      expect(() => loadEnv({ ...valid, DATABASE_URL: value })).toThrow(
        /DATABASE_URL/,
      );
    },
  );

  it.each(['localhost:6379', 'not a url', 'http://localhost:6379'])(
    'rejeita REDIS_URL inválida (%s)',
    (value) => {
      expect(() => loadEnv({ ...valid, REDIS_URL: value })).toThrow(
        /REDIS_URL/,
      );
    },
  );

  it('aceita postgresql:// e rediss://', () => {
    expect(() =>
      loadEnv({
        ...valid,
        DATABASE_URL: 'postgresql://u:p@db.example.com:5432/arenaz',
        REDIS_URL: 'rediss://cache.example.com:6380',
      }),
    ).not.toThrow();
  });

  it('API_PORT padrão 4000', () => {
    expect(loadEnv({ ...valid, API_PORT: undefined }).API_PORT).toBe(4000);
  });

  it('lista as variáveis S3 que faltam', () => {
    expect(() => loadEnv({})).toThrow(
      /S3_ENDPOINT[\s\S]*S3_BUCKET[\s\S]*S3_ACCESS_KEY_ID[\s\S]*S3_SECRET_ACCESS_KEY[\s\S]*S3_PUBLIC_URL/,
    );
  });

  it('S3_REGION padrão us-east-1 e S3_FORCE_PATH_STYLE padrão true', () => {
    const env = loadEnv(valid);
    expect(env.S3_REGION).toBe('us-east-1');
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('interpreta S3_FORCE_PATH_STYLE=%s', (raw, expected) => {
    expect(
      loadEnv({ ...valid, S3_FORCE_PATH_STYLE: raw }).S3_FORCE_PATH_STYLE,
    ).toBe(expected);
  });

  it.each(['yes', '1', ''])(
    'rejeita S3_FORCE_PATH_STYLE inválido (%s)',
    (raw) => {
      expect(() => loadEnv({ ...valid, S3_FORCE_PATH_STYLE: raw })).toThrow(
        /S3_FORCE_PATH_STYLE/,
      );
    },
  );

  it.each(['localhost:9000', 'not a url', 'ftp://localhost:9000'])(
    'rejeita S3_ENDPOINT e S3_PUBLIC_URL inválidos (%s)',
    (value) => {
      expect(() => loadEnv({ ...valid, S3_ENDPOINT: value })).toThrow(
        /S3_ENDPOINT/,
      );
      expect(() => loadEnv({ ...valid, S3_PUBLIC_URL: value })).toThrow(
        /S3_PUBLIC_URL/,
      );
    },
  );

  it('rejeita credenciais e bucket vazios', () => {
    expect(() =>
      loadEnv({ ...valid, S3_BUCKET: '', S3_ACCESS_KEY_ID: '' }),
    ).toThrow(/S3_BUCKET[\s\S]*S3_ACCESS_KEY_ID/);
  });

  it('INTERNAL_API_TOKEN é opcional e vazio vale como ausente', () => {
    expect(loadEnv(valid).INTERNAL_API_TOKEN).toBeUndefined();
    expect(
      loadEnv({ ...valid, INTERNAL_API_TOKEN: '' }).INTERNAL_API_TOKEN,
    ).toBeUndefined();
  });

  it('aceita INTERNAL_API_TOKEN com 32+ caracteres', () => {
    const token = 't'.repeat(32);
    expect(
      loadEnv({ ...valid, INTERNAL_API_TOKEN: token }).INTERNAL_API_TOKEN,
    ).toBe(token);
  });

  it('rejeita INTERNAL_API_TOKEN curto', () => {
    expect(() => loadEnv({ ...valid, INTERNAL_API_TOKEN: 'curto' })).toThrow(
      /INTERNAL_API_TOKEN/,
    );
  });

  it('GEO_PROVIDER padrão http', () => {
    expect(loadEnv(valid).GEO_PROVIDER).toBe('http');
  });

  it('aceita GEO_PROVIDER=fake fora de produção', () => {
    expect(loadEnv({ ...valid, GEO_PROVIDER: 'fake' }).GEO_PROVIDER).toBe(
      'fake',
    );
  });

  it('rejeita GEO_PROVIDER=fake com NODE_ENV=production', () => {
    expect(() =>
      loadEnv({ ...valid, GEO_PROVIDER: 'fake', NODE_ENV: 'production' }),
    ).toThrow(/GEO_PROVIDER/);
  });

  it('aceita GEO_PROVIDER=http em produção', () => {
    // Production cannot boot until the real payment provider exists (Plano 4):
    // the only complaint left must be about PAYMENT_PROVIDER, none about GEO.
    let message = '';
    try {
      loadEnv({ ...valid, GEO_PROVIDER: 'http', NODE_ENV: 'production' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/PAYMENT_PROVIDER/);
    expect(message).not.toMatch(/GEO_PROVIDER/);
    expect(message.trim().split('\n')).toHaveLength(2);
  });

  it('rejeita GEO_PROVIDER desconhecido', () => {
    expect(() => loadEnv({ ...valid, GEO_PROVIDER: 'google' })).toThrow(
      /GEO_PROVIDER/,
    );
  });
});
