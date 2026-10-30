import { afterEach, describe, expect, it, vi } from 'vitest';

// The real api-client: only the network is replaced.
import { createBooking } from './booking-client';

const INPUT = {
  fieldId: '11111111-1111-4111-8111-111111111111',
  startsAt: '2026-11-06T18:00:00.000-03:00',
  durationMinutes: 60,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createBooking failures', () => {
  it('keeps the rate limit text on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 429 }))),
    );

    expect(await createBooking(INPUT)).toMatchObject({
      ok: false,
      status: 429,
      message: 'Muitas tentativas. Aguarde um instante e tente de novo.',
    });
  });

  it('falls back to the generic text on a 5xx without detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('oops', { status: 502 }))),
    );

    expect(await createBooking(INPUT)).toMatchObject({
      ok: false,
      status: 502,
      message: 'Não foi possível concluir. Tente novamente.',
    });
  });

  it('shows the API text on a 5xx that has one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          Response.json(
            { title: 'x', status: 503, detail: 'Serviço indisponível' },
            { status: 503 },
          ),
        ),
      ),
    );

    expect(await createBooking(INPUT)).toMatchObject({
      ok: false,
      message: 'Serviço indisponível',
    });
  });
});
