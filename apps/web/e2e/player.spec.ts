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
 * Clicks "Carregar mais" until the venue's card shows up. Older data in the
 * shared database may fill the first pages; the seeded name sorts first, so
 * this rarely loops, but it keeps the test deterministic either way.
 */
async function findCard(page: Page, name: string) {
  const card = page.getByRole('link', { name: new RegExp(name) });
  for (let attempt = 1; attempt < MAX_RESULT_PAGES; attempt += 1) {
    if ((await card.count()) > 0) break;
    await page.getByRole('link', { name: 'Carregar mais' }).click();
    await page.waitForURL(/page=/);
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
  await page.getByLabel('Onde').fill('vila madalena');
  await page
    .getByRole('combobox', { name: 'Esporte' })
    .selectOption({ label: 'Society' });
  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(page).toHaveURL(/\/buscar\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe('vila madalena');
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
      'Vila Madalena, São Paulo. O endereço exato aparece depois da reserva.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Reserva online chega em breve.')).toBeVisible();

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

test('sem violações de acessibilidade graves', async ({ page, published }) => {
  const paths = [
    '/',
    '/buscar?q=vila madalena',
    `/espacos/${published.slug}`,
  ] as const;
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await seriousViolations(page), `violações em ${path}`).toEqual([]);
  }
});
