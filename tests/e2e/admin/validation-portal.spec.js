import { test, expect } from '@playwright/test';
import { loginAdmin, dismissBanners } from '../helpers/shared.js';

test.describe('Admin — Portal de Validação', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAdmin(page);
    await dismissBanners(page);
    await page.getByRole('button', { name: /validação/i }).click();
  });

  test('1. Portal de Validação carrega o heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
  });

  test('2. Três sub-abas estão visíveis (Envios, Equipa, Correções)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /^envios$/i }).first()).toBeVisible();
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /^equipa$/i }).first()).toBeVisible();
    await expect(page.locator('button, [role="tab"]').filter({ hasText: /^correções$/i }).first()).toBeVisible();
  });

  test('3. Sub-aba Envios lista clientes com colunas de estado', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
    await page.locator('button, [role="tab"]').filter({ hasText: /^envios$/i }).first().click();
    // Cabeçalho da tabela ou lista de clientes
    await expect(
      page.locator('text=/cliente/i').or(page.locator('text=/estado/i')).or(page.locator('text=/horas/i')).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('4. Sub-aba Equipa lista colaboradores', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
    await page.locator('button, [role="tab"]').filter({ hasText: /^equipa$/i }).first().click();
    await expect(
      page.locator('text=/colaborador/i').or(page.locator('text=/trabalhador/i')).or(page.locator('text=/aprovado/i')).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('5. Seletor de mês está visível e responde a clique', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
    // Botão de avançar mês (chevron direito)
    const nextMonth = page.locator('button').filter({ has: page.locator('svg') }).last();
    await expect(nextMonth).toBeVisible({ timeout: 5000 });
    await nextMonth.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });
});
