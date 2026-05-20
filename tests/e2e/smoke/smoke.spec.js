import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'admin123';

async function loginAdmin(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('button', { name: /geral/i })).toBeVisible({ timeout: 15000 });
}

test.describe('Smoke Test — App Magnetic', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Página de login carrega', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input').first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('2. Login como admin', async ({ page }) => {
    await loginAdmin(page);
    await expect(page.getByRole('button', { name: /geral/i })).toBeVisible();
  });

  test('3. Abas principais do admin são navegáveis', async ({ page }) => {
    await loginAdmin(page);

    const tabs = [
      /equipa/i,
      /clientes/i,
      /documentos/i,
      /horários/i,
    ];

    // Dismiss any notification banners that may block clicks
    await page.locator('[class*="z-\\[9999\\]"] button').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);

    for (const label of tabs) {
      await page.getByRole('button', { name: label }).click({ force: true });
      await page.waitForTimeout(800);
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(page.locator('text=Cannot read')).not.toBeVisible();
    }
  });

  test('4. Credenciais inválidas mostram erro', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('senha_errada_xpto');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
    // Deve continuar na página de login (sem dashboard)
    await expect(page.getByRole('button', { name: /geral/i })).not.toBeVisible();
  });

  test('5. Logout regressa ao login', async ({ page }) => {
    await loginAdmin(page);
    // Botão de logout — último botão com ícone na barra de topo
    const logoutBtn = page.locator('nav button, header button').filter({ hasText: '' }).last();
    // Tenta via texto ou aria; fallback: procura o único LogOut
    const logoutByTitle = page.locator('button[title="Logout"], button[aria-label="Logout"]');
    if (await logoutByTitle.count() > 0) {
      await logoutByTitle.first().click();
    } else {
      // Percorre botões no final da navbar
      await page.locator('.hidden.md\\:flex button').last().click();
    }
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 8000 });
  });
});
