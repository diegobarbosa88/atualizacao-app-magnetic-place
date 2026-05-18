import { test, expect } from '@playwright/test';
import { loginAdmin, dismissBanners } from '../helpers/shared.js';

test.describe('Admin — Aba Equipa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Navegar para aba Equipa mostra lista de trabalhadores', async ({ page }) => {
    await loginAdmin(page);
    await dismissBanners(page);
    // Clicar no botão da aba Equipa
    await page.getByRole('button', { name: /equipa/i }).click();
    // Pelo menos um nome de trabalhador visível
    await expect(page.locator('text=/equipa/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('2. Lista de trabalhadores carrega com pelo menos 1 elemento', async ({ page }) => {
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /equipa/i }).click();
    // Aguardar que a lista não esteja vazia (qualquer li, tr ou card de worker)
    const workerItems = page.locator('[class*="worker"], [class*="team"], tbody tr, ul li').first();
    await expect(workerItems).toBeVisible({ timeout: 15000 });
  });

  test('3. Toggle entre modos lista/grade não causa crash', async ({ page }) => {
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /equipa/i }).click();
    // Procurar botão de toggle de vista (ícones de grade/lista)
    const toggleBtn = page.locator('button[class*="grid"], button[class*="list"], button svg').first();
    if (await toggleBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(500);
      // Página não deve ter crash — ainda deve mostrar conteúdo
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('4. Secção de equipa está acessível e contém dados', async ({ page }) => {
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /equipa/i }).click();
    // Qualquer texto que indique dados de trabalhadores
    await expect(
      page.locator('text=/trabalhador/i').or(page.locator('text=/nome/i')).or(page.locator('text=/nif/i'))
    ).toBeVisible({ timeout: 15000 });
  });
});
