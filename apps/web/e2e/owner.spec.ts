import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Senha@123';
const PHOTO = fileURLToPath(new URL('fixtures/quadra.png', import.meta.url));

let sequence = 0;
/** Unique per call, so tests (and reruns against the same DB) never collide. */
function unique(): string {
  sequence += 1;
  return `${String(Date.now())}${String(sequence)}`;
}

async function signUp(page: Page, name: string): Promise<void> {
  await page.goto('/cadastro');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('E-mail').fill(`dono+${unique()}@mail.com`);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL('/conta');
}

/**
 * From /painel to the saved venue's page: "+ Novo espaço", the form with the
 * address filled by the (fake) CEP lookup, then "Criar espaço".
 */
async function createVenue(page: Page, name: string): Promise<string> {
  await page.goto('/painel');
  await page.getByRole('link', { name: '+ Novo espaço' }).click();
  await expect(page).toHaveURL('/painel/espacos/novo');

  await page.getByLabel('Nome do espaço').fill(name);
  await page.getByLabel('Telefone').fill('11987654321');

  const cep = page.getByLabel('CEP');
  await cep.fill('05435000');
  await cep.blur();
  await expect(page.getByLabel('Bairro')).toHaveValue('Vila Madalena');
  await expect(page.getByLabel('Rua')).not.toHaveValue('');
  await expect(page.getByLabel('UF')).toHaveValue('SP');
  await expect(page.getByLabel('Latitude')).not.toHaveValue('');
  await expect(page.getByLabel('Longitude')).not.toHaveValue('');
  await page.getByLabel('Número', { exact: true }).fill('100');

  await page.getByLabel('Vestiário').check();
  await page.getByLabel('Estacionamento').check();
  await page.getByRole('radio', { name: 'Moderada' }).check();

  await page.getByRole('button', { name: 'Criar espaço' }).click();
  await expect(page).toHaveURL(/\/painel\/espacos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname;
}

test('dono cadastra e publica um espaço', async ({ page }) => {
  const venueName = `Arena E2E ${unique()}`;
  await signUp(page, 'Dono E2E');
  const venuePath = await createVenue(page, venueName);

  await expect(page.getByText('Rascunho')).toBeVisible();

  // Horário: segunda a sexta, 08:00 às 23:00.
  for (const day of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
    const row = page.getByRole('group', { name: day, exact: true });
    await row.getByLabel('Aberto').check();
    await row.getByLabel('Abertura').selectOption({ label: '08:00' });
    await row.getByLabel('Fechamento').selectOption({ label: '23:00' });
  }
  await page.getByRole('button', { name: 'Salvar horário' }).click();
  await expect(page.getByText('Horário salvo')).toBeVisible();

  // Quadra com preço base.
  await page.getByRole('link', { name: '+ Nova quadra' }).click();
  await expect(page).toHaveURL(`${venuePath}/quadras/novo`);
  await page.getByLabel('Nome da quadra').fill('Society 1');
  await page.getByLabel('Society', { exact: true }).check();
  await page.getByLabel('Piso').selectOption({ label: 'Grama sintética' });
  await page.getByLabel('Formato').selectOption({ label: '7x7' });
  await page.getByLabel('Duração mínima').selectOption({ label: '60 minutos' });
  const basePrice = page.getByLabel('Preço base por hora');
  await basePrice.fill('R$ 180,00');
  await basePrice.blur();
  await page.getByRole('button', { name: 'Criar quadra' }).click();
  await expect(page).toHaveURL(/\/painel\/quadras\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Society 1' }),
  ).toBeVisible();

  // Faixa: sexta e sábado, 18:00 às 23:00, R$ 250,00.
  const rules = page.getByRole('region', { name: 'Faixas de preço' });
  await rules.getByRole('button', { name: '+ Faixa' }).click();
  await rules.getByRole('button', { name: 'Sexta', exact: true }).click();
  await rules.getByRole('button', { name: 'Sábado', exact: true }).click();
  await rules.getByLabel('Início').selectOption({ label: '18:00' });
  await rules.getByLabel('Fim').selectOption({ label: '23:00' });
  const rulePrice = rules.getByLabel('Preço por hora');
  await rulePrice.fill('R$ 250,00');
  await rulePrice.blur();
  await rules.getByRole('button', { name: 'Salvar faixas' }).click();
  await expect(rules.getByText('Faixas salvas')).toBeVisible();

  // Sem foto o espaço ainda não pode ser publicado.
  await page.getByRole('link', { name: 'Voltar ao espaço' }).click();
  await expect(page).toHaveURL(venuePath);
  await expect(page.getByText('Nenhuma foto ainda.')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /foto/i }),
  ).toBeVisible();
  await expect(page.getByText('Rascunho')).toBeVisible();

  // Foto: envio direto ao armazenamento por URL assinada.
  await page.getByLabel('Adicionar fotos').setInputFiles(PHOTO);
  const photo = page.getByRole('img', { name: 'Foto 1 do espaço' });
  await expect(photo).toBeVisible();
  // A imagem é servida pelo armazenamento: tem que ter carregado de verdade
  // (ela é `loading="lazy"`, então precisa entrar na área visível antes).
  await photo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // Publicar.
  await page.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Espaço publicado')).toBeVisible();
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Despublicar' })).toBeVisible();

  // Aparece na lista do painel como publicado.
  await page.getByRole('link', { name: 'Meus espaços' }).first().click();
  await expect(page).toHaveURL('/painel');
  const card = page.getByRole('link', { name: new RegExp(venueName) });
  await expect(card).toContainText('Publicado');
  await expect(card).toContainText('1 quadra');
});

test('outro dono não abre o espaço', async ({ page, browser, baseURL }) => {
  await signUp(page, 'Dona A');
  const venuePath = await createVenue(page, `Arena Privada ${unique()}`);

  const other = await browser.newContext({ baseURL });
  try {
    const otherPage = await other.newPage();
    await signUp(otherPage, 'Dono B');

    const response = await otherPage.goto(venuePath);
    expect(response?.status()).toBe(404);
    await expect(
      otherPage.getByRole('heading', {
        level: 1,
        name: 'Página não encontrada',
      }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});
