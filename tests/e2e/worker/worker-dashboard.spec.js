import { test, expect } from '@playwright/test';
import { loginWorker, dismissBanners, WORKER_USERNAME, WORKER_PASSWORD } from '../helpers/shared.js';

test.describe('Worker — Dashboard e Registo de Horas', () => {
  test.skip(!WORKER_USERNAME || !WORKER_PASSWORD, 'PLAYWRIGHT_WORKER_USERNAME e PLAYWRIGHT_WORKER_PASSWORD não definidos em .env.playwright');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Login como worker carrega o dashboard', async ({ page }) => {
    await loginWorker(page);
    // Saudação com "Olá," visível
    await expect(page.locator('text=/Olá,/i')).toBeVisible({ timeout: 15000 });
  });

  test('2. Dashboard mostra cards de horas do mês', async ({ page }) => {
    await loginWorker(page);
    await dismissBanners(page);
    // Cards de horas hoje e total mês
    await expect(page.locator('text=/horas hoje/i').or(page.locator('text=/total/i')).first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Formulário de novo registo está visível', async ({ page }) => {
    await loginWorker(page);
    await dismissBanners(page);
    // Título do formulário
    await expect(page.locator('text=/novo registo/i')).toBeVisible({ timeout: 10000 });
  });

  test('4. Campos Entrada e Saída aceitam input de hora', async ({ page }) => {
    await loginWorker(page);
    await dismissBanners(page);
    // Inputs de hora (type=time)
    const timeInputs = page.locator('input[type="time"]');
    await expect(timeInputs.first()).toBeVisible({ timeout: 10000 });
    await timeInputs.first().fill('09:00');
    await expect(timeInputs.first()).toHaveValue('09:00');
    if (await timeInputs.count() > 1) {
      await timeInputs.nth(1).fill('17:00');
      await expect(timeInputs.nth(1)).toHaveValue('17:00');
    }
  });

  test('5. Botão de registo rápido existe na lista de dias', async ({ page }) => {
    await loginWorker(page);
    await dismissBanners(page);
    // Botão com ícone Zap (registo rápido) — pelo menos um visível na lista
    const zapButtons = page.locator('button.bg-amber-50, button[class*="amber"]').first();
    await expect(zapButtons).toBeVisible({ timeout: 10000 });
  });
});
