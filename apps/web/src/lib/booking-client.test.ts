import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiSend: vi.fn() }));
vi.mock('./api-client', () => ({ apiSend: mocks.apiSend }));

import {
  addDaysToDateKey,
  bookingNextPath,
  createBooking,
  dateChips,
  fetchAvailability,
  perPersonCents,
  pickerDays,
  withinHorizon,
} from './booking-client';

const FIELD_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const availability = {
  date: '2026-11-06',
  timezone: 'America/Sao_Paulo',
  fields: [
    {
      id: FIELD_ID,
      name: 'Quadra 1',
      minSlotMinutes: 60,
      slots: [
        {
          startsAt: '2026-11-06T18:00:00.000-03:00',
          endsAt: '2026-11-06T19:00:00.000-03:00',
          available: true,
          priceCents: 18000,
          extra: 'dropped',
        },
      ],
    },
  ],
};

describe('fetchAvailability', () => {
  it('asks the API for the day without caching and parses the answer', async () => {
    const fetchMock = stubFetch(Response.json(availability));

    const result = await fetchAvailability('arena-x', '2026-11-06');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/venues/arena-x/availability?date=2026-11-06',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fields[0]?.slots[0]).not.toHaveProperty('extra');
    }
  });

  it('turns a problem answer into a failure with its message', async () => {
    stubFetch(
      Response.json(
        { title: 'x', status: 422, detail: 'Data fora do período' },
        { status: 422 },
      ),
    );

    const result = await fetchAvailability('arena-x', '2027-01-01');

    expect(result).toMatchObject({
      ok: false,
      status: 422,
      message: 'Data fora do período',
    });
  });

  it.each([
    [429, 'Muitas tentativas. Aguarde um instante e tente de novo.'],
    [503, 'Não foi possível concluir. Tente novamente.'],
  ])('gives a usable message for a %i answer', async (status, message) => {
    stubFetch(new Response('{}', { status }));

    const result = await fetchAvailability('arena-x', '2026-11-06');

    expect(result).toMatchObject({ ok: false, status, message });
  });

  it('fails without throwing when the network is down', async () => {
    stubFetch(new TypeError('network'));

    const result = await fetchAvailability('arena-x', '2026-11-06');

    expect(result).toMatchObject({ ok: false, status: 0 });
  });

  it('fails when the answer has an unexpected shape', async () => {
    stubFetch(Response.json({ nope: true }));

    const result = await fetchAvailability('arena-x', '2026-11-06');

    expect(result.ok).toBe(false);
  });

  it('can be aborted', async () => {
    const fetchMock = stubFetch(Response.json(availability));
    const controller = new AbortController();

    await fetchAvailability('arena-x', '2026-11-06', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe('createBooking', () => {
  it('posts the field, the start and the duration only', async () => {
    mocks.apiSend.mockResolvedValue({ ok: true, data: {} });

    await createBooking({
      fieldId: FIELD_ID,
      startsAt: '2026-11-06T18:00:00.000-03:00',
      durationMinutes: 90,
    });

    expect(mocks.apiSend).toHaveBeenCalledWith(
      'POST',
      '/bookings',
      {
        fieldId: FIELD_ID,
        startsAt: '2026-11-06T18:00:00.000-03:00',
        durationMinutes: 90,
      },
      expect.anything(),
    );
  });
});

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysToDateKey('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateKey('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('lists today and the next 13 days, labelled for people', () => {
    // 2026-11-05 is a Thursday.
    const chips = dateChips('2026-11-05');

    expect(chips).toHaveLength(14);
    expect(chips[0]).toMatchObject({ date: '2026-11-05', label: 'Hoje' });
    expect(chips[1]).toMatchObject({ date: '2026-11-06', label: 'Amanhã' });
    expect(chips[2]).toMatchObject({ date: '2026-11-07', label: 'Sáb 7' });
    expect(chips[3]).toMatchObject({ date: '2026-11-08', label: 'Dom 8' });
    expect(chips[13]).toMatchObject({ date: '2026-11-18', label: 'Qua 18' });
  });

  it('names every chip with its own text first and the full date after', () => {
    const chips = dateChips('2026-11-05');

    expect(chips[0]?.ariaLabel).toBe('Hoje, quinta-feira, 5 de novembro');
    expect(chips[1]?.ariaLabel).toBe('Amanhã, sexta-feira, 6 de novembro');
    expect(chips[2]?.ariaLabel).toBe('Sáb 7, sábado, 7 de novembro');
  });
});

describe('venue page day buttons', () => {
  it('shows today and the next 13 days as a weekday and a day number', () => {
    // 2026-10-28 is a Wednesday.
    const days = pickerDays('2026-10-28');

    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({
      date: '2026-10-28',
      weekday: 'Hoje',
      dayOfMonth: 28,
      whenLabel: 'Qua, 28 out',
    });
    expect(days[1]).toMatchObject({ weekday: 'Qui', dayOfMonth: 29 });
    expect(days[4]).toMatchObject({
      date: '2026-11-01',
      weekday: 'Dom',
      dayOfMonth: 1,
      whenLabel: 'Dom, 1 nov',
    });
  });

  it('names each button with its visible text first and the full date after', () => {
    const days = pickerDays('2026-10-28');

    expect(days[0]?.ariaLabel).toBe('Hoje 28, quarta-feira, 28 de outubro');
    expect(days[1]?.ariaLabel).toBe('Qui 29, quinta-feira, 29 de outubro');
  });

  it('runs up to a later day asked for, within the 60 day horizon', () => {
    const days = pickerDays('2026-10-28', '2026-12-01');

    expect(days).toHaveLength(35);
    expect(days.at(-1)?.date).toBe('2026-12-01');
    expect(pickerDays('2026-10-28', '2026-10-30')).toHaveLength(14);
  });

  it('knows the bookable horizon: today up to 60 days ahead', () => {
    expect(withinHorizon('2026-10-28', '2026-10-28')).toBe(true);
    expect(withinHorizon('2026-10-28', '2026-12-27')).toBe(true);
    expect(withinHorizon('2026-10-28', '2026-12-28')).toBe(false);
    expect(withinHorizon('2026-10-28', '2026-10-27')).toBe(false);
  });
});

describe('perPersonCents', () => {
  it('divides the total and rounds up to the cent', () => {
    expect(perPersonCents(44000, 14)).toBe(3143);
    expect(perPersonCents(36000, 12)).toBe(3000);
    expect(perPersonCents(1000, 3)).toBe(334);
  });
});

describe('bookingNextPath', () => {
  const intent = {
    date: '2026-11-06',
    fieldId: FIELD_ID,
    startsAt: '2026-11-06T18:00:00.000-03:00',
    durationMinutes: 60,
  };

  it('keeps the group size when there is one', () => {
    const url = new URL(bookingNextPath('arena-x', intent, 12), 'http://x');
    expect(url.searchParams.get('jogadores')).toBe('12');
    expect(url.searchParams.get('duracao')).toBe('60');
  });

  it('leaves the group size out otherwise', () => {
    const url = new URL(bookingNextPath('arena-x', intent), 'http://x');
    expect(url.searchParams.has('jogadores')).toBe(false);
  });
});
