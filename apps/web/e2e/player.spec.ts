import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test as base,
  type Page,
  type Response,
} from '@playwright/test';
import {
  OwnerApi,
  PRIVATE,
  seedDraftVenue,
  seedPublishedVenue,
  type SeededVenue,
} from './helpers/seed';

interface Fixtures {
  /** Published venue seeded by a brand-new owner, through the API. */
  published: SeededVenue;
  /** Venue that was never published. */
  draft: SeededVenue;
}

/** Each fixture gets its own request context, so owners never share cookies. */
const test = base.extend<Fixtures>({
  published: async ({ playwright, baseURL }, provide) => {
    const request = await playwright.request.newContext({ baseURL });
    try {
      await provide(
        await seedPublishedVenue(new OwnerApi(request, baseURL ?? '')),
      );
    } finally {
      await request.dispose();
    }
  },
  draft: async ({ playwright, baseURL }, provide) => {
    const request = await playwright.request.newContext({ baseURL });
    try {
      await provide(await seedDraftVenue(new OwnerApi(request, baseURL ?? '')));
    } finally {
      await request.dispose();
    }
  },
});

const MAX_RESULT_PAGES = 5;

/**
 * The venue's card. The search is for the venue's own unique neighborhood, so
 * it is the only result and is on page 1; the bounded "Carregar mais" loop is
 * a safety net that waits for each exact page before looking again.
 */
async function findCard(page: Page, name: string) {
  const card = page.getByRole('link', { name: new RegExp(name) });
  for (let current = 1; current < MAX_RESULT_PAGES; current += 1) {
    if ((await card.count()) > 0) break;
    const next = current + 1;
    await page.getByRole('link', { name: 'Carregar mais' }).click();
    await page.waitForURL(new RegExp(`[?&]page=${String(next)}(&|$)`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      `Página ${String(next)}`,
    );
  }
  return card;
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    )
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

test('jogador encontra e abre um espaço publicado', async ({
  page,
  published,
}) => {
  // Anonymous visitor: the home's search bar.
  await page.goto('/');
  // Lower case on purpose: the search ignores case. The neighborhood is unique
  // to this seed, so older data cannot crowd the card out of the first page.
  const where = published.neighborhood.toLowerCase();
  await page.getByLabel('Onde').fill(where);
  await page
    .getByRole('combobox', { name: 'Esporte' })
    .selectOption({ label: 'Society' });
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(page).toHaveURL(/\/buscar\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe(where);
  expect(url.searchParams.get('sport')).toBe('futebol_society');
  await expect(page.getByText(/\d+ espaços?$/).first()).toBeVisible();

  const card = await findCard(page, published.name);
  await expect(card).toBeVisible();
  await card.click();

  // The venue page.
  await expect(page).toHaveURL(`/espacos/${published.slug}`);
  await expect(
    page.getByRole('heading', { level: 1, name: published.name }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quadras' })).toBeVisible();
  await expect(page.getByText('Society 1')).toBeVisible();
  await expect(page.getByText(/a partir de/i).first()).toBeVisible();
  await expect(page.getByText(/R\$\s*180\b/).first()).toBeVisible();
  await expect(
    page.getByText(
      `${published.neighborhood}, São Paulo. O endereço exato aparece depois da reserva.`,
    ),
  ).toBeVisible();
  // The time picker sits in the booking card (desktop viewport).
  await expect(
    page.getByRole('complementary', { name: 'Reserva' }).getByRole('group', {
      name: 'Data',
    }),
  ).toBeVisible();

  // Nothing private leaks: not in the text, and not anywhere in the markup.
  const html = await page.content();
  const text = await page.locator('body').innerText();
  for (const secret of [
    PRIVATE.number,
    PRIVATE.street,
    PRIVATE.phoneDigits,
    '93456',
    PRIVATE.cep,
    '05435-000',
    String(PRIVATE.lat),
    String(PRIVATE.lng),
  ]) {
    expect(text, `texto com "${secret}"`).not.toContain(secret);
    expect(html, `HTML com "${secret}"`).not.toContain(secret);
  }

  // Picking a time as an anonymous visitor leads to sign in, which brings the
  // choice back. The seed opens Monday to Friday, so walk the date chips until
  // one has a free time.
  const times = page.getByRole('group', { name: 'Horários' });
  const chips = page.getByRole('group', { name: 'Data' }).getByRole('button');
  const chipCount = await chips.count();
  let freeTime = times.locator('button:enabled').first();
  for (let index = 0; index < chipCount; index += 1) {
    await chips.nth(index).click();
    await expect(times.getByText('Carregando horários')).toHaveCount(0);
    freeTime = times.locator('button:enabled').first();
    if ((await times.locator('button:enabled').count()) > 0) break;
  }
  await freeTime.click();
  await expect(
    page.getByRole('status', { name: 'Resumo da reserva' }),
  ).toContainText(/\d{2}:\d{2}–\d{2}:\d{2}/);
  await page.getByRole('button', { name: 'Reservar' }).click();

  await expect(page).toHaveURL(/\/entrar\?next=/);
  const next = new URL(page.url()).searchParams.get('next') ?? '';
  const nextUrl = new URL(next, 'http://localhost');
  expect(nextUrl.pathname).toBe(`/espacos/${published.slug}`);
  expect(nextUrl.searchParams.get('duracao')).toBe('60');
  expect(nextUrl.searchParams.get('data')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('rascunho dá 404', async ({ page, draft }) => {
  const response: Response | null = await page.goto(`/espacos/${draft.slug}`);
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Página não encontrada' }),
  ).toBeVisible();
  await expect(page.getByText(draft.name)).toHaveCount(0);
  // Next adds its own `noindex` for not-found pages next to ours: every
  // robots tag on the page must forbid indexing.
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((tags) => tags.map((tag) => tag.getAttribute('content')));
  expect(robots.length).toBeGreaterThan(0);
  for (const content of robots) expect(content).toContain('noindex');
});

const VIEWPORTS = [
  { label: 'desktop', width: 1280, height: 800 },
  { label: 'mobile 375px', width: 375, height: 812 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`sem violações de acessibilidade graves (${viewport.label})`, async ({
    page,
    published,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const scan = async (what: string): Promise<void> => {
      expect(await seriousViolations(page), `violações em ${what}`).toEqual([]);
    };

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan('/');

    await page.goto('/buscar?q=vila madalena');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Wait for the map and a pin instead of guessing with network idle. Below
    // lg the map is hidden until "Mapa" is chosen, so it is only attached.
    await page
      .locator('.leaflet-container')
      .first()
      .waitFor({ state: 'attached' });
    await page.locator('.leaflet-marker-icon').first().waitFor({
      state: 'attached',
    });
    await scan(`/buscar (${viewport.label}, lista)`);
    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Mapa' }).click();
      await expect(page.locator('.leaflet-container').first()).toBeVisible();
      await scan(`/buscar (${viewport.label}, mapa)`);
    }

    await page.goto(`/espacos/${published.slug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: published.name }),
    ).toBeVisible();
    await page.locator('.leaflet-container').first().waitFor();
    await scan(`/espacos/${published.slug}`);

    // The time picker: in the card from lg up, in the sheet below it. Scans
    // run with the default motion, after every animation and transition has
    // ended, so axe never reads a colour halfway through one.
    const settled = async (): Promise<void> => {
      await page.waitForFunction(() => document.getAnimations().length === 0);
    };
    if (viewport.width < 1024) {
      await page.getByRole('button', { name: 'Escolher horário' }).click();
      await expect(
        page.getByRole('dialog', { name: 'Escolha o horário' }),
      ).toBeVisible();
    }
    const times = page.getByRole('group', { name: 'Horários' });
    await expect(times.getByText('Carregando horários')).toHaveCount(0);
    await settled();
    await scan(`seletor de horário (${viewport.label})`);
    const chips = page.getByRole('group', { name: 'Data' }).getByRole('button');
    for (let index = 0; index < (await chips.count()); index += 1) {
      await chips.nth(index).click();
      await expect(times.getByText('Carregando horários')).toHaveCount(0);
      if ((await times.locator('button:enabled').count()) > 0) break;
    }
    await times.locator('button:enabled').first().click();
    await expect(
      page.getByRole('status', { name: 'Resumo da reserva' }),
    ).toContainText('R$');
    await settled();
    await scan(`seletor com horário escolhido (${viewport.label})`);
  });
}
