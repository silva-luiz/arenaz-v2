import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { OwnerApi, unique } from './helpers/seed';

async function seriousViolations(page: Page) {
  // Chips and buttons transition their colors; axe must not read them midway.
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

/** The first weekday (Mon-Fri, the seeded opening days) after today in São Paulo. */
function nextWeekday(): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const day = new Date(`${today}T12:00:00Z`);
  for (let offset = 1; offset <= 6; offset += 1) {
    const candidate = new Date(day.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = candidate.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      return candidate.toISOString().slice(0, 10);
    }
  }
  throw new Error('sem dia útil nos próximos 6 dias');
}

test('dono vê a agenda, cria reserva manual, bloqueia e cancela', async ({
  page,
  baseURL,
}) => {
  // The owner is signed in through the API; the cookie lands in the page.
  const api = new OwnerApi(page.request, baseURL ?? '');
  await api.signUp('Dono Agenda');
  const venue = await api.createDraftVenue(`Arena Agenda ${unique()}`);
  await api.setHours(venue.id);
  await api.createSocietyCourt(venue.id);
  const date = nextWeekday();
  const customer = `Escolinha ${unique()}`;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/painel/espacos/${venue.id}`);
  // The venue page's own "Agenda" link (the sidebar has one too).
  await page.getByRole('main').getByRole('link', { name: 'Agenda' }).click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /^(Bom dia|Boa tarde|Boa noite), Dono$/,
    }),
  ).toBeVisible();
  await expect(page.getByText('Ocupação hoje')).toBeVisible();
  await expect(page.getByText('Recebido na semana')).toBeVisible();

  await page.goto(`/painel/espacos/${venue.id}/agenda?data=${date}`);
  const table = page.getByRole('table');
  await expect(
    table.getByRole('rowheader', { name: 'Society 1' }),
  ).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '18h' })).toBeAttached();

  // Manual booking, 18:00-19:00 (the form defaults).
  await page.getByRole('button', { name: '+ Reserva manual' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reserva manual' });
  await dialog.getByLabel('Nome do cliente').fill(customer);
  await dialog.getByRole('button', { name: 'Criar reserva' }).click();
  const booking = table.getByRole('button', {
    name: `Society 1, 18:00–19:00, reserva de ${customer}, manual, confirmada`,
  });
  await expect(booking).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Reserva manual criada');

  // The same time again: the API refuses and the form stays open.
  await page.getByRole('button', { name: '+ Reserva manual' }).click();
  const again = page.getByRole('dialog', { name: 'Reserva manual' });
  await again.getByLabel('Nome do cliente').fill('Outro cliente');
  await again.getByRole('button', { name: 'Criar reserva' }).click();
  await expect(again.getByRole('alert')).toContainText(/reserva|ocupado/i);
  await again.getByRole('button', { name: 'Fechar' }).click();

  // A block at 20:00-21:00.
  await page.getByRole('button', { name: 'Bloquear horário' }).click();
  const blockDialog = page.getByRole('dialog', { name: 'Bloquear horário' });
  await blockDialog.getByLabel('Início').selectOption({ label: '20:00' });
  await blockDialog.getByLabel('Fim').selectOption({ label: '21:00' });
  await blockDialog.getByLabel('Motivo').fill('Chuva');
  await blockDialog.getByRole('button', { name: 'Bloquear' }).click();
  await expect(
    table.getByRole('button', {
      name: 'Society 1, 20:00–21:00, bloqueio, Chuva',
    }),
  ).toBeVisible();

  expect(await seriousViolations(page), 'violações na agenda').toEqual([]);
  await page.screenshot({
    path: 'e2e/test-results/captures/agenda-1280.png',
    fullPage: true,
  });

  // The detail under the agenda, then cancelling the booking.
  await booking.click();
  await expect(booking).toHaveAttribute('aria-pressed', 'true');
  const detail = page.getByRole('region', { name: 'Reserva selecionada' });
  await expect(detail).toBeFocused();
  await expect(detail.getByText(customer)).toBeVisible();
  await expect(detail.getByText('Reserva manual · R$ 180,00')).toBeVisible();
  expect(await seriousViolations(page), 'violações no detalhe').toEqual([]);
  await detail.getByRole('button', { name: 'Cancelar reserva' }).click();
  await detail.getByRole('button', { name: 'Sim, cancelar' }).click();
  await expect(booking).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Reserva cancelada');

  // Phone: a list per court instead of the table.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole('table')).toHaveCount(0);
  const court = page.getByRole('region', { name: 'Society 1' });
  await expect(
    court.getByRole('button', {
      name: 'Society 1, 20:00–21:00, bloqueio, Chuva',
    }),
  ).toBeVisible();
  expect(await seriousViolations(page), 'violações no celular').toEqual([]);
  await page.screenshot({
    path: 'e2e/test-results/captures/agenda-375.png',
    fullPage: true,
  });
});
