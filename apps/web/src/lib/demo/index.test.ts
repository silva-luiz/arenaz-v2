import { afterEach, describe, expect, it, vi } from 'vitest';

/** `isDemoMode` is read once at import time, so each case loads a fresh module. */
async function loadDemo(mode: string | undefined) {
  vi.resetModules();
  if (mode === undefined) vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
  else vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', mode);
  return import('./index');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('demo mode on', () => {
  it('is on only for the exact string "true"', async () => {
    expect((await loadDemo('true')).isDemoMode).toBe(true);
    expect((await loadDemo('TRUE')).isDemoMode).toBe(false);
    expect((await loadDemo('1')).isDemoMode).toBe(false);
    expect((await loadDemo(undefined)).isDemoMode).toBe(false);
  });

  it('gives the prototype rating and review count of Arena Vila Madalena', async () => {
    const { demoVenueExtras } = await loadDemo('true');
    const extras = demoVenueExtras('arena-vila-madalena');
    expect(extras).toMatchObject({ rating: '4,92', reviewsCount: 318 });
    expect(extras?.hostHighlight).toBe(
      'Dono destaque · responde em cerca de 10 min',
    );
  });

  it('has the sub-ratings and the two reviews of the prototype', async () => {
    const { demoVenueExtras } = await loadDemo('true');
    const extras = demoVenueExtras('arena-vila-madalena');
    expect(extras?.subRatings).toEqual([
      { label: 'Gramado', value: '4,9' },
      { label: 'Iluminação', value: '5,0' },
      { label: 'Vestiário', value: '4,7' },
      { label: 'Pontualidade', value: '5,0' },
    ]);
    expect(extras?.reviews.map((review) => review.author)).toEqual([
      'Rafael',
      'Camila',
    ]);
    expect(extras?.reviews[0]?.context).toBe('Mensalista há 6 meses');
    expect(extras?.reviews[1]?.context).toBe('Jogou em outubro');
  });

  it('covers every demo seed slug with a rating', async () => {
    const { demoVenueExtras, DEMO_VENUE_SLUGS } = await loadDemo('true');
    expect(DEMO_VENUE_SLUGS).toHaveLength(13);
    for (const slug of DEMO_VENUE_SLUGS) {
      const extras = demoVenueExtras(slug);
      expect(extras, slug).not.toBeNull();
      expect(extras?.rating, slug).toMatch(/^\d,\d{2}$/);
      expect(extras?.reviewsCount, slug).toBeGreaterThan(0);
    }
  });

  it('marks the two venues the prototype calls "Preferido da galera"', async () => {
    const { demoVenueExtras } = await loadDemo('true');
    expect(demoVenueExtras('futevolei-praia-urbana')?.badge).toBe(
      'Preferido da galera',
    );
    expect(demoVenueExtras('saibro-butanta')?.badge).toBe(
      'Preferido da galera',
    );
    expect(demoVenueExtras('padel-pinheiros')?.badge).toBeUndefined();
  });

  it('returns null for a slug without a fixture', async () => {
    const { demoVenueExtras } = await loadDemo('true');
    expect(demoVenueExtras('uma-quadra-real')).toBeNull();
  });

  it('lists the open games of the prototype', async () => {
    const { demoOpenGames } = await loadDemo('true');
    expect(demoOpenGames.map((game) => game.title)).toEqual([
      'Fut feminino de quarta',
      'Racha do Butantã',
      'Society de quinta',
      'Futsal coberto pós-trampo',
    ]);
    expect(demoOpenGames[0]).toMatchObject({
      when: 'Hoje · 21h',
      missingCount: 2,
      shareCents: 1500,
    });
  });

  it('has the owner numbers of the prototype panel', async () => {
    const { demoOwnerStats } = await loadDemo('true');
    expect(demoOwnerStats).toEqual({
      payoutCents: 312000,
      payoutDay: '30/10',
      monthlyTeams: 12,
      renewingThisWeek: 2,
    });
  });

  it('has the marketing counters of the home', async () => {
    const { demoMarketingCounters } = await loadDemo('true');
    expect(demoMarketingCounters).toEqual({
      freeCourtsToday: 312,
      openGames: 27,
    });
  });
});

describe('demo mode off', () => {
  it('invents nothing', async () => {
    const demo = await loadDemo(undefined);
    expect(demo.demoVenueExtras('arena-vila-madalena')).toBeNull();
    expect(demo.demoOpenGames).toEqual([]);
  });

  it('stays off for "false"', async () => {
    const demo = await loadDemo('false');
    expect(demo.isDemoMode).toBe(false);
    expect(demo.demoVenueExtras('arena-vila-madalena')).toBeNull();
  });
});

describe('missingLabel', () => {
  it('uses the singular for one missing player', async () => {
    const { missingLabel } = await loadDemo('true');
    expect(missingLabel(1)).toBe('Falta 1');
    expect(missingLabel(3)).toBe('Faltam 3');
  });
});
