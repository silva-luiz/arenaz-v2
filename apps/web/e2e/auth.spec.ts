import { expect, test } from '@playwright/test';

test('criar conta, sair e entrar de novo', async ({ page }) => {
  const email = `e2e+${String(Date.now())}@mail.com`;
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill('Jogador E2E');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('Senha@123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/conta');
  await expect(
    page.getByRole('heading', { name: 'Olá, Jogador E2E' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.goto('/entrar?next=/conta');
  await page.getByLabel('E-mail').fill(email.toUpperCase());
  await page.getByLabel('Senha').fill('Senha@123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL('/conta');
});

test('cookie adulterado em /conta redireciona para login', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: 'better-auth.session_token',
      value: 'forjado',
      url: baseURL,
    },
  ]);
  await page.goto('/conta');
  await expect(page).toHaveURL(/\/entrar\?next=(%2F|\/)conta$/);
});
