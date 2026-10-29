import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';
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

  // Mobile first: the whole flow at 375px, with the sheet.
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
