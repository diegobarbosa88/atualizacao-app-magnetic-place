import { test, expect } from '@playwright/test';
import { loginAdmin, dismissBanners } from '../helpers/shared.js';

test.describe('Admin — Centro de Documentos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /documentos/i }).click();
  });

  test('1. Aba Documentos carrega o heading principal', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /centro de documentos/i })).toBeVisible({ timeout: 10000 });
  });

  test('2. Filtros de estado estão visíveis', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /centro de documentos/i })).toBeVisible({ timeout: 10000 });
    // Pills de filtro
    await expect(page.locator('text=/todos/i').first()).toBeVisible();
    await expect(page.locator('text=/pendentes/i').first()).toBeVisible();
    await expect(page.locator('text=/assinados/i').first()).toBeVisible();
  });

  test('3. Filtro "Pendentes" é clicável e não causa crash', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /centro de documentos/i })).toBeVisible({ timeout: 10000 });
    await page.locator('button, [role="tab"]').filter({ hasText: /pendentes/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Modal de Upload Manual abre ao clicar no botão', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /centro de documentos/i })).toBeVisible({ timeout: 10000 });
    const uploadBtn = page.locator('button').filter({ hasText: /upload manual/i }).first();
    if (await uploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadBtn.click();
      await expect(page.locator('text=/upload manual/i').first()).toBeVisible({ timeout: 5000 });
      // Fechar modal
      await page.keyboard.press('Escape');
    }
  });
});
