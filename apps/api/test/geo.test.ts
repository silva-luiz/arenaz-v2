import {
  cepLookupResponseSchema,
  type CepLookupResponse,
  type Problem,
} from '@arenaz/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FakeGeo } from '../src/geo/fake.geo.js';
import { GEO, GeoUnavailableError, type GeoPort } from '../src/geo/geo.port.js';
import { HttpGeo } from '../src/geo/http.geo.js';
import { createApp } from '../src/app.factory.js';
import { asUser, buildTestApp, signUpAs, testEnv } from './helpers.js';

const VIACEP_PAULISTA = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function timeoutError(): DOMException {
  return new DOMException(
    'The operation was aborted due to timeout',
    'TimeoutError',
  );
}

type Handler = (
  url: URL,
  init: RequestInit | undefined,
) => Response | Promise<Response>;

/** An injected `fetch` that routes by host and records every call. */
function fakeFetch(handlers: { viacep?: Handler; nominatim?: Handler }) {
  const calls: { url: URL; init: RequestInit | undefined }[] = [];
  const fetchFn = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    calls.push({ url, init });
    const handler =
      url.hostname === 'viacep.com.br' ? handlers.viacep : handlers.nominatim;
    if (!handler)
      return Promise.reject(new Error(`unexpected call to ${url.href}`));
    return Promise.resolve(handler(url, init));
  });
  const to = (host: string) => calls.filter((c) => c.url.hostname === host);
  return {
    fetch: fetchFn as unknown as typeof fetch,
    mock: fetchFn,
    calls,
    viacep: () => to('viacep.com.br'),
    nominatim: () => to('nominatim.openstreetmap.org'),
  };
}

/** A manual clock: `sleep` advances it, so throttling is observable. */
function fakeClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: (ms: number) => {
      sleeps.push(ms);
      t += ms;
      return Promise.resolve();
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

const NOMINATIM_HIT = [{ lat: '-23.5649942', lon: '-46.6517657' }];

describe('HttpGeo', () => {
  it('ViaCEP ok + Nominatim ok → endereço com localização', async () => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json(NOMINATIM_HIT),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const result = await geo.lookupCep('01310100');

    expect(result).toEqual({
      cep: '01310100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      location: { lat: -23.5649942, lng: -46.6517657 },
    });
    expect(cepLookupResponseSchema.safeParse(result).success).toBe(true);

    const [via] = f.viacep();
    expect(via?.url.href).toBe('https://viacep.com.br/ws/01310100/json/');
    expect(via?.init?.signal).toBeInstanceOf(AbortSignal);

    const [nom] = f.nominatim();
    expect(`${nom?.url.origin ?? ''}${nom?.url.pathname ?? ''}`).toBe(
      'https://nominatim.openstreetmap.org/search',
    );
    expect(Object.fromEntries(nom?.url.searchParams ?? [])).toEqual({
      format: 'jsonv2',
      countrycodes: 'br',
      limit: '1',
      street: 'Avenida Paulista',
      city: 'São Paulo',
      state: 'SP',
      postalcode: '01310-100',
    });
    expect(new Headers(nom?.init?.headers).get('user-agent')).toBe(
      'ArenaZ/0.1 (contato via repositório)',
    );
    expect(nom?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([true, 'true'])(
    'ViaCEP erro=%s → null, sem chamar o Nominatim',
    async (erro) => {
      const f = fakeFetch({ viacep: () => json({ erro }) });
      const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

      expect(await geo.lookupCep('99999991')).toBeNull();
      expect(f.nominatim()).toHaveLength(0);
    },
  );

  it('Nominatim com timeout → location null (não é erro) e não vai para o cache', async () => {
    let nominatimUp = false;
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => {
        if (!nominatimUp) throw timeoutError();
        return json(NOMINATIM_HIT);
      },
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const first = await geo.lookupCep('01310102');
    expect(first).toMatchObject({ street: 'Avenida Paulista', location: null });

    // The failure was transient: the next lookup tries again.
    nominatimUp = true;
    const second = await geo.lookupCep('01310102');
    expect(second?.location).toEqual({ lat: -23.5649942, lng: -46.6517657 });
  });

  it('Nominatim 5xx ou JSON quebrado → location null', async () => {
    const f1 = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json({ error: 'busy' }, 503),
    });
    const r1 = await new HttpGeo({ fetch: f1.fetch, ...fakeClock() }).lookupCep(
      '01310103',
    );
    expect(r1?.location).toBeNull();

    const f2 = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => new Response('<html>nope</html>'),
    });
    const r2 = await new HttpGeo({ fetch: f2.fetch, ...fakeClock() }).lookupCep(
      '01310104',
    );
    expect(r2?.location).toBeNull();
  });

  it('segunda chamada usa o cache (fetch chamado 2 vezes no total)', async () => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json(NOMINATIM_HIT),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const first = await geo.lookupCep('01310105');
    const second = await geo.lookupCep('01310105');

    expect(f.mock).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first);
    // Callers cannot corrupt the cache by mutating what they got.
    if (second?.location) second.location.lat = 0;
    expect((await geo.lookupCep('01310105'))?.location?.lat).toBe(-23.5649942);
  });

  it('cacheia o "não encontrado"', async () => {
    const f = fakeFetch({ viacep: () => json({ erro: true }) });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    expect(await geo.lookupCep('99999992')).toBeNull();
    expect(await geo.lookupCep('99999992')).toBeNull();
    expect(f.mock).toHaveBeenCalledTimes(1);
  });

  it('o cache expira após 24 h', async () => {
    const f = fakeFetch({ viacep: () => json({ erro: true }) });
    const clock = fakeClock();
    const geo = new HttpGeo({ fetch: f.fetch, ...clock });

    await geo.lookupCep('99999993');
    clock.advance(24 * 60 * 60 * 1000 - 1);
    await geo.lookupCep('99999993');
    expect(f.mock).toHaveBeenCalledTimes(1);

    clock.advance(2);
    await geo.lookupCep('99999993');
    expect(f.mock).toHaveBeenCalledTimes(2);
  });

  it('o cache guarda no máximo 1000 CEPs (descarta o menos usado)', async () => {
    const f = fakeFetch({ viacep: () => json({ erro: true }) });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });
    const cep = (n: number) => String(20_000_000 + n);

    for (let n = 0; n < 1000; n++) await geo.lookupCep(cep(n));
    expect(f.mock).toHaveBeenCalledTimes(1000);

    // Touch the oldest entry so it becomes the most recently used...
    await geo.lookupCep(cep(0));
    expect(f.mock).toHaveBeenCalledTimes(1000);
    // ...then overflow: the least recently used one (n=1) is evicted instead.
    await geo.lookupCep(cep(1000));
    expect(f.mock).toHaveBeenCalledTimes(1001);

    await geo.lookupCep(cep(0));
    expect(f.mock).toHaveBeenCalledTimes(1001);
    await geo.lookupCep(cep(1));
    expect(f.mock).toHaveBeenCalledTimes(1002);
  });

  it('buscas simultâneas do mesmo CEP viram uma só', async () => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json(NOMINATIM_HIT),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const [a, b] = await Promise.all([
      geo.lookupCep('01310106'),
      geo.lookupCep('01310106'),
    ]);

    expect(a).toEqual(b);
    expect(f.viacep()).toHaveLength(1);
  });

  it.each([
    ['erro de rede', () => Promise.reject(new TypeError('fetch failed'))],
    ['timeout', () => Promise.reject(timeoutError())],
    ['HTTP 500', () => Promise.resolve(json({ message: 'boom' }, 500))],
    ['HTTP 503', () => Promise.resolve(json({}, 503))],
    ['HTTP 404 (não é "não encontrado")', () => Promise.resolve(json({}, 404))],
    ['corpo que não é JSON', () => Promise.resolve(new Response('<html>'))],
    ['corpo com formato inesperado', () => Promise.resolve(json({ foo: 1 }))],
  ])(
    'ViaCEP: %s → GeoUnavailableError e nada é cacheado',
    async (_name, failing) => {
      let healthy = false;
      const f = fakeFetch({
        viacep: () => (healthy ? json(VIACEP_PAULISTA) : failing()),
        nominatim: () => json(NOMINATIM_HIT),
      });
      const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

      await expect(geo.lookupCep('01310107')).rejects.toBeInstanceOf(
        GeoUnavailableError,
      );

      healthy = true;
      const result = await geo.lookupCep('01310107');
      expect(result).toMatchObject({ street: 'Avenida Paulista' });
    },
  );

  it('Nominatim sem resultado → tenta de novo só com postalcode + country', async () => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: (url) =>
        url.searchParams.has('street') ? json([]) : json(NOMINATIM_HIT),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const result = await geo.lookupCep('01310108');

    expect(result?.location).toEqual({ lat: -23.5649942, lng: -46.6517657 });
    expect(f.nominatim()).toHaveLength(2);
    expect(
      Object.fromEntries(f.nominatim()[1]?.url.searchParams ?? []),
    ).toEqual({
      format: 'jsonv2',
      countrycodes: 'br',
      limit: '1',
      postalcode: '01310-108',
    });
  });

  it('Nominatim sem resultado nas duas tentativas → location null (e cacheia)', async () => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json([]),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    expect((await geo.lookupCep('01310109'))?.location).toBeNull();
    expect(f.nominatim()).toHaveLength(2);
    await geo.lookupCep('01310109');
    expect(f.mock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['fora do Brasil', [{ lat: '40.7128', lon: '-74.0060' }]],
    ['não numérico', [{ lat: 'abc', lon: '-46.6' }]],
    ['vazio', [{ lat: '', lon: '' }]],
    ['sem lat/lon', [{ display_name: 'x' }]],
  ])('coordenadas inválidas (%s) → location null', async (_name, body) => {
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json(body),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const result = await geo.lookupCep('01310110');

    expect(result).toMatchObject({
      street: 'Avenida Paulista',
      location: null,
    });
  });

  it('usa timeout de 3000 ms e não segue redirecionamentos nas duas chamadas', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    try {
      const f = fakeFetch({
        viacep: () => json(VIACEP_PAULISTA),
        nominatim: () => json(NOMINATIM_HIT),
      });
      const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

      await geo.lookupCep('01310118');

      expect(timeout).toHaveBeenCalledTimes(2);
      expect(timeout.mock.calls.every(([ms]) => ms === 3000)).toBe(true);
      expect(f.viacep()[0]?.init?.redirect).toBe('error');
      expect(f.nominatim()[0]?.init?.redirect).toBe('error');
    } finally {
      timeout.mockRestore();
    }
  });

  it('CEP que não tem 8 dígitos nunca chega à rede', async () => {
    const f = fakeFetch({});
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    expect(await geo.lookupCep('../etc')).toBeNull();
    expect(f.mock).not.toHaveBeenCalled();
  });

  it('espaça as chamadas ao Nominatim em pelo menos 1 s, mesmo em paralelo', async () => {
    const clock = fakeClock();
    const starts: number[] = [];
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => {
        starts.push(clock.now());
        return json(NOMINATIM_HIT);
      },
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...clock });

    await Promise.all(
      ['01310111', '01310112', '01310113'].map((c) => geo.lookupCep(c)),
    );

    expect(starts).toHaveLength(3);
    const [first = 0, second = 0, third = 0] = starts;
    expect(second - first).toBeGreaterThanOrEqual(1000);
    expect(third - second).toBeGreaterThanOrEqual(1000);
  });

  it('não dorme quando já passou mais de 1 s desde a última chamada', async () => {
    const clock = fakeClock();
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => json(NOMINATIM_HIT),
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...clock });

    await geo.lookupCep('01310114');
    clock.advance(1500);
    await geo.lookupCep('01310115');

    expect(clock.sleeps).toEqual([]);
  });

  it('uma falha do Nominatim não trava a fila', async () => {
    let calls = 0;
    const f = fakeFetch({
      viacep: () => json(VIACEP_PAULISTA),
      nominatim: () => {
        calls += 1;
        if (calls === 1) throw timeoutError();
        return json(NOMINATIM_HIT);
      },
    });
    const geo = new HttpGeo({ fetch: f.fetch, ...fakeClock() });

    const [a, b] = await Promise.all([
      geo.lookupCep('01310116'),
      geo.lookupCep('01310117'),
    ]);

    expect(a?.location).toBeNull();
    expect(b?.location).not.toBeNull();
  });
});

describe('FakeGeo', () => {
  it('tem uma tabela fixa e devolve null para o resto', async () => {
    const geo = new FakeGeo();

    expect(await geo.lookupCep('01310100')).toEqual({
      cep: '01310100',
      street: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      location: { lat: -23.5614, lng: -46.6559 },
    });
    expect(await geo.lookupCep('05435000')).toEqual({
      cep: '05435000',
      street: 'Rua Harmonia',
      neighborhood: 'Vila Madalena',
      city: 'São Paulo',
      state: 'SP',
      location: { lat: -23.5568, lng: -46.6916 },
    });
    expect(await geo.lookupCep('12345678')).toBeNull();
  });
});

describe('GET /api/geo/cep/:cep', () => {
  let app: NestFastifyApplication;
  let user: ReturnType<typeof asUser>;

  beforeAll(async () => {
    app = await buildTestApp();
    const { cookie } = await signUpAs(app, 'Dono do CEP');
    user = asUser(app, cookie);
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 com o endereço e a localização', async () => {
    const res = await user.get('/api/geo/cep/01310100');

    expect(res.statusCode).toBe(200);
    const body = cepLookupResponseSchema.parse(res.json());
    expect(body).toMatchObject({
      cep: '01310100',
      street: 'Avenida Paulista',
      location: { lat: -23.5614, lng: -46.6559 },
    });
  });

  it('aceita o CEP com máscara', async () => {
    const res = await user.get('/api/geo/cep/05435-000');

    expect(res.statusCode).toBe(200);
    expect(res.json<CepLookupResponse>().cep).toBe('05435000');
  });

  it('404 "CEP não encontrado" quando o CEP não existe', async () => {
    const res = await user.get('/api/geo/cep/99999999');

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<Problem>().detail).toBe('CEP não encontrado');
  });

  it.each(['123', 'abcdefgh', '0131010099'])(
    '422 com erro no campo para "%s"',
    async (cep) => {
      const res = await user.get(`/api/geo/cep/${cep}`);

      expect(res.statusCode).toBe(422);
      expect(res.json<Problem>().errors).toEqual({ cep: ['CEP inválido'] });
    },
  );

  it('401 sem login', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/geo/cep/01310100',
    });

    expect(res.statusCode).toBe(401);
  });

  it('503 "Serviço de CEP indisponível" quando o provedor falha (distinto do 404)', async () => {
    const geo = app.get<GeoPort>(GEO);
    const spy = vi
      .spyOn(geo, 'lookupCep')
      .mockRejectedValueOnce(new GeoUnavailableError('viacep: timeout'));

    const res = await user.get('/api/geo/cep/01310100');

    spy.mockRestore();
    expect(res.statusCode).toBe(503);
    expect(res.json<Problem>()).toMatchObject({
      status: 503,
      detail: 'Serviço de CEP indisponível, tente de novo',
    });
  });

  it('um erro inesperado continua sendo 500, sem vazar a causa', async () => {
    const geo = app.get<GeoPort>(GEO);
    const spy = vi
      .spyOn(geo, 'lookupCep')
      .mockRejectedValueOnce(new Error('segredo interno'));

    const res = await user.get('/api/geo/cep/01310100');

    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('segredo interno');
  });
});

describe('limite de requisições da rota', () => {
  it('30 por minuto (o limite global é 100)', async () => {
    // The limiter is off in NODE_ENV=test, so run this app as development.
    const app = await createApp({ ...testEnv, NODE_ENV: 'development' });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    try {
      const { cookie } = await signUpAs(app, 'Dono do limite');
      const user = asUser(app, cookie);

      const statuses: number[] = [];
      for (let i = 0; i < 31; i++) {
        statuses.push((await user.get('/api/geo/cep/01310100')).statusCode);
      }

      expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
      expect(statuses[30]).toBe(429);
    } finally {
      await app.close();
    }
  });
});
