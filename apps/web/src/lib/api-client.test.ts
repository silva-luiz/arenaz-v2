import { venueSchema } from '@arenaz/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiSend } from './api-client';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const passthrough = {
  safeParse: (input: unknown) => ({ success: true as const, data: input }),
};

interface SentInit {
  method?: string;
  credentials?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function lastInit(): SentInit {
  const call = fetchMock.mock.calls[0] as [string, SentInit] | undefined;
  if (!call) throw new Error('fetch was not called');
  return call[1];
}

describe('apiSend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('calls the same-origin /api proxy with credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: 1 }));

    await apiSend('GET', '/geo/cep/01310100', undefined, passthrough);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/geo/cep/01310100');
    expect(lastInit()).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
    });
  });

  it('sends no content-type and no body when there is no body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await apiSend('POST', '/owner/venues/abc/publish');

    const init = lastInit();
    expect(init.body).toBeUndefined();
    const names = Object.keys(init.headers ?? {}).map((n) => n.toLowerCase());
    expect(names).not.toContain('content-type');
  });

  it('sends JSON with a content-type only when a body is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { a: 1 }));

    await apiSend('PUT', '/x', [{ weekday: 1 }], passthrough);

    const init = lastInit();
    expect(init.body).toBe(JSON.stringify([{ weekday: 1 }]));
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('returns the validated data on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { a: 1 }));

    await expect(apiSend('GET', '/x', undefined, passthrough)).resolves.toEqual(
      { ok: true, data: { a: 1 } },
    );
  });

  it('handles 204 without reading a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiSend('DELETE', '/owner/venues/abc')).resolves.toEqual({
      ok: true,
      data: undefined,
    });
  });

  it('reports a failure when a success body does not match the schema', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1 }));

    const result = await apiSend('GET', '/x', undefined, venueSchema);

    expect(result).toMatchObject({ ok: false, status: 200 });
  });

  it('reports a failure when a schema is given but the body is empty (204)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiSend('GET', '/x', undefined, venueSchema);

    expect(result).toMatchObject({ ok: false, status: 204 });
  });

  it('maps problem+json errors to the detail and field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        title: 'Dados inválidos',
        status: 422,
        detail: 'Despublique o espaço antes de deixá-lo incompleto',
        errors: { hours: ['Defina o horário de funcionamento'] },
      }),
    );

    const result = await apiSend('PUT', '/x', []);

    expect(result).toEqual({
      ok: false,
      status: 422,
      message: 'Despublique o espaço antes de deixá-lo incompleto',
      fieldErrors: { hours: ['Defina o horário de funcionamento'] },
    });
  });

  it('survives an error response that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }));

    const result = await apiSend('GET', '/x');

    expect(result).toMatchObject({
      ok: false,
      status: 502,
      message: 'Não foi possível concluir. Tente novamente.',
      fieldErrors: {},
    });
  });

  it('turns a network failure into a result instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await apiSend('GET', '/x');

    expect(result).toMatchObject({ ok: false, status: 0, fieldErrors: {} });
  });
});
