import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {
  OwnerApi,
  PRIVATE,
  seedPublishedVenue,
  unique,
  type SeededVenue,
} from './helpers/seed';

const PASSWORD = 'Senha@123';

const test = base.extend<{ published: SeededVenue }>({
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
});

async function seriousViolations(page: Page) {
  // Buttons and chips transition their colors; axe must not read them midway.
  await page.waitForFunction(() => document.getAnimations().length === 0);
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
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

test('jogador reserva, paga com o Pix simulado e vê o endereço', async ({
  page,
  published,
  baseURL,
}) => {
  // A brand-new player, signed in through the API (the cookie lands in the page).
  const signUp = await page.request.post('/api/auth/sign-up/email', {
    headers: { origin: baseURL ?? '' },
    data: {
      name: 'Jogadora Teste',
      email: `jogadora+${unique()}@mail.com`,
      password: PASSWORD,
    },
  });
  expect(signUp.ok()).toBe(true);

  // Mobile first: the whole flow at 375px, with the booking bar.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/espacos/${published.slug}`);
  await page.getByRole('button', { name: 'Escolher horário' }).click();
  const times = page.getByRole('group', { name: 'Horários' });
  const chips = page.getByRole('group', { name: 'Data' }).getByRole('button');
  await expect(times.getByText('Carregando horários')).toHaveCount(0);
  for (let index = 0; index < (await chips.count()); index += 1) {
    await chips.nth(index).click();
    await expect(times.getByText('Carregando horários')).toHaveCount(0);
    if ((await times.locator('button:enabled').count()) > 0) break;
  }
  await times.locator('button:enabled').first().click();
  await page.getByRole('button', { name: 'Reservar' }).click();

  // Checkout: held, with the QR, the code and the countdown.
  await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pague para garantir' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code do Pix/ })).toBeVisible();
  await expect(page.getByText(/^\d{2}:\d{2}$/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copiar código' }),
  ).toBeVisible();
  // Nothing private before the payment.
  const heldText = await page.locator('body').innerText();
  for (const secret of [PRIVATE.street, PRIVATE.number, PRIVATE.phoneDigits]) {
    expect(heldText).not.toContain(secret);
  }
  expect(await seriousViolations(page), 'violações no checkout').toEqual([]);
  await page.screenshot({
    path: 'e2e/test-results/captures/checkout-375.png',
    fullPage: true,
  });

  // "Simular pagamento": the page reloads as a confirmed booking.
  await page.getByRole('button', { name: 'Simular pagamento' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Quadra garantida' }),
  ).toBeVisible();
  await expect(page.getByText(PRIVATE.street)).toBeVisible();
  await expect(page.getByText(PRIVATE.number, { exact: false })).toBeVisible();
  await expect(page.getByText(PRIVATE.phone)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancelar reserva' }),
  ).toBeVisible();
  expect(await seriousViolations(page), 'violações na reserva').toEqual([]);
  await page.screenshot({
    path: 'e2e/test-results/captures/confirmada-375.png',
    fullPage: true,
  });

  // The list shows it under "Próximas", and the tab bar marks "Reservas".
  await page.getByRole('link', { name: 'Reservas' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Minhas reservas' }),
  ).toBeVisible();
  const upcoming = page.getByRole('region', { name: 'Próximas' });
  await expect(upcoming.getByText(published.name)).toBeVisible();
  await expect(upcoming.getByText('Confirmada')).toBeVisible();
  expect(await seriousViolations(page), 'violações na lista').toEqual([]);
  await page.screenshot({
    path: 'e2e/test-results/captures/reservas-375.png',
    fullPage: true,
  });
});

test('anônimo é levado à entrada', async ({ page }) => {
  const id = '3f0c2b9e-6a4e-4d6b-9a52-1b6e0c7d9f10';
  await page.goto(`/reservas/${id}`);
  await expect(page).toHaveURL(/\/entrar\?next=\/reservas\//);
  await page.goto('/reservas');
  await expect(page).toHaveURL(/\/entrar\?next=\/reservas$/);
});

/** A player created through the API in a throwaway context (not signed in the page). */
async function createPlayer(
  browser: Browser,
  baseURL: string,
  name: string,
): Promise<{ email: string }> {
  const email = `jogador+${unique()}@mail.com`;
  const context = await browser.newContext({ baseURL });
  try {
    const response = await context.request.post('/api/auth/sign-up/email', {
      headers: { origin: baseURL },
      data: { name, email, password: PASSWORD },
    });
    expect(response.ok()).toBe(true);
  } finally {
    await context.close();
  }
  return { email };
}

/**
 * Picks `count` consecutive free 60-minute blocks on the first day after today that has
 * them (tomorrow, or the next opening day), in the card (desktop) picker.
 */
async function pickBlocks(page: Page, count: number): Promise<void> {
  const times = page.getByRole('group', { name: 'Horários' });
  const chips = page.getByRole('group', { name: 'Data' }).getByRole('button');
  await expect(times.getByText('Carregando horários')).toHaveCount(0);
  const total = await chips.count();
  for (let day = 1; day < total; day += 1) {
    await chips.nth(day).click();
    await expect(times.getByText('Carregando horários')).toHaveCount(0);
    const buttons = times.getByRole('button');
    const size = await buttons.count();
    // The grid has a button per 30 minutes; the court books in 60-minute
    // blocks, so a block is two buttons. Tap the first block, then the start
    // of the last one: the selection grows through the blocks in between.
    const span = count * 2;
    for (let start = 0; start + span <= size; start += 1) {
      let free = true;
      for (let offset = 0; offset < span; offset += 1) {
        if (!(await buttons.nth(start + offset).isEnabled())) free = false;
      }
      if (!free) continue;
      await buttons.nth(start).click();
      if (count > 1) await buttons.nth(start + span - 2).click();
      return;
    }
  }
  throw new Error('nenhum dia com horários livres seguidos');
}

async function newOwnerWithVenue(
  browser: Browser,
  baseURL: string,
): Promise<{ context: BrowserContext; venue: SeededVenue }> {
  const context = await browser.newContext({ baseURL });
  const venue = await seedPublishedVenue(
    new OwnerApi(context.request, baseURL),
  );
  return { context, venue };
}

test('anônimo escolhe 2 horários, entra, paga e o dono vê na agenda', async ({
  browser,
  page,
  baseURL,
}) => {
  const origin = baseURL ?? '';
  const owner = await newOwnerWithVenue(browser, origin);
  try {
    const { venue } = owner;
    const first = `Bia${unique()}`;
    const { email } = await createPlayer(browser, origin, `${first} Souza`);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/espacos/${venue.slug}`);
    await pickBlocks(page, 2);
    await expect(
      page.getByRole('status', { name: 'Resumo da reserva' }),
    ).toContainText('R$ 360');
    await page.getByRole('button', { name: 'Reservar' }).click();

    // Anonymous: sent to sign in, and brought back to the same choice.
    await expect(page).toHaveURL(/\/entrar\?next=/);
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL((url) =>
      url.href.includes(`/espacos/${venue.slug}?data=`),
    );
    const date = new URL(page.url()).searchParams.get('data') ?? '';
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(
      page.getByRole('status', { name: 'Resumo da reserva' }),
    ).toContainText('R$ 360');
    await page.getByRole('button', { name: 'Reservar' }).click();

    await expect(page).toHaveURL(/\/reservas\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Pague para garantir' }),
    ).toBeVisible();
    expect(await seriousViolations(page), 'violações no checkout').toEqual([]);
    await page.getByRole('button', { name: 'Simular pagamento' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Quadra garantida' }),
    ).toBeVisible();
    await expect(page.getByText(PRIVATE.street)).toBeVisible();

    // The owner sees it on the agenda of that day.
    const agenda = await owner.context.newPage();
    await agenda.setViewportSize({ width: 1280, height: 900 });
    await agenda.goto(`/painel/espacos/${venue.id}/agenda?data=${date}`);
    const table = agenda.getByRole('table');
    await expect(
      table.getByRole('button', {
        name: new RegExp(`, reserva de ${first}.*, pelo app, confirmada$`),
      }),
    ).toBeVisible();
    expect(await seriousViolations(agenda), 'violações na agenda').toEqual([]);
  } finally {
    await owner.context.close();
  }
});

test('dois jogadores disputam o mesmo horário: só um reserva', async ({
  browser,
  baseURL,
}) => {
  const origin = baseURL ?? '';
  const owner = await newOwnerWithVenue(browser, origin);
  const contexts: BrowserContext[] = [];
  try {
    const pages: Page[] = [];
    for (const label of ['A', 'B']) {
      const { email } = await createPlayer(browser, origin, `Jogador ${label}`);
      const context = await browser.newContext({ baseURL: origin });
      contexts.push(context);
      const signIn = await context.request.post('/api/auth/sign-in/email', {
        headers: { origin },
        data: { email, password: PASSWORD },
      });
      expect(signIn.ok()).toBe(true);
      const page = await context.newPage();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/espacos/${owner.venue.slug}`);
      await pickBlocks(page, 1);
      await expect(
        page.getByRole('button', { name: 'Reservar' }),
      ).toBeEnabled();
      pages.push(page);
    }

    // Both have the same free block selected; they press "Reservar" together.
    await Promise.all(
      pages.map((page) =>
        page.getByRole('button', { name: 'Reservar' }).click(),
      ),
    );

    const outcome = async (page: Page): Promise<'won' | 'lost'> =>
      Promise.race([
        page
          .waitForURL(/\/reservas\/[0-9a-f-]{36}$/)
          .then(() => 'won' as const),
        page
          .getByText('Esse horário acabou de ser reservado')
          .waitFor()
          .then(() => 'lost' as const),
      ]);
    const results = (await Promise.all(pages.map(outcome))).sort();
    expect(results).toEqual(['lost', 'won']);
  } finally {
    for (const context of contexts) await context.close();
    await owner.context.close();
  }
});
