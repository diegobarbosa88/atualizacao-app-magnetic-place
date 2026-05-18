import { test, expect } from '@playwright/test';
import { loginAdmin, dismissBanners } from '../helpers/shared.js';

test.describe('Admin — Portal Validação → Correções', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  async function navigateToCorrections(page) {
    await loginAdmin(page);
    await dismissBanners(page);
    // Navegar para Portal Validação
    await page.getByRole('button', { name: /validação/i }).click();
    // Clicar na sub-aba Correções
    const correcoes = page.locator('main button').filter({ hasText: /correções/i }).first();
    await expect(correcoes).toBeVisible({ timeout: 10000 });
    await correcoes.click();
  }

  test('1. Portal Validação carrega após login admin', async ({ page }) => {
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /validação/i }).click();
    await expect(page.locator('text=/validação/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('2. Sub-aba Correções mostra "Inbox de Correções"', async ({ page }) => {
    await navigateToCorrections(page);
    await expect(page.locator('text=/inbox de correções/i')).toBeVisible({ timeout: 10000 });
  });

  test('3. Filtro "Abertas" existe e é clicável', async ({ page }) => {
    await navigateToCorrections(page);
    const filtroAbertas = page.locator('button, [role="tab"], label').filter({ hasText: /abertas/i }).first();
    await expect(filtroAbertas).toBeVisible({ timeout: 10000 });
    await filtroAbertas.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Filtro "Aplicadas" existe e é clicável', async ({ page }) => {
    await navigateToCorrections(page);
    const filtroAplicadas = page.locator('button, [role="tab"], label').filter({ hasText: /aplicadas/i }).first();
    await expect(filtroAplicadas).toBeVisible({ timeout: 10000 });
    await filtroAplicadas.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });
});
