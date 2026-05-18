import { test, expect } from '@playwright/test';
import { loginWorker, dismissBanners, WORKER_USERNAME, WORKER_PASSWORD } from '../helpers/shared.js';

test.describe('Worker — Submeter Registo de Horas', () => {
  test.skip(!WORKER_USERNAME || !WORKER_PASSWORD, 'PLAYWRIGHT_WORKER_USERNAME e PLAYWRIGHT_WORKER_PASSWORD não definidos em .env.playwright');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginWorker(page);
    await dismissBanners(page);
    // Aguardar que o dashboard carregue
    await expect(page.locator('text=/olá,/i')).toBeVisible({ timeout: 15000 });
  });

  test('1. Botão GRAVAR REGISTO está visível no formulário', async ({ page }) => {
    await expect(page.getByRole('button', { name: /gravar registo/i })).toBeVisible({ timeout: 10000 });
  });

  test('2. Formulário sem horas não submete (botão inativo ou sem toast)', async ({ page }) => {
    // Clicar em gravar sem preencher Entrada/Saída
    await page.getByRole('button', { name: /gravar registo/i }).click();
    await page.waitForTimeout(1000);
    // Toast de sucesso NÃO deve aparecer
    await expect(page.locator('text=/registo inserido com sucesso/i')).not.toBeVisible();
  });

  test('3. Submeter registo válido mostra mensagem de sucesso', async ({ page }) => {
    // Preencher Entrada e Saída
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill('09:00');
    await timeInputs.nth(1).fill('17:00');
    // Gravar
    await page.getByRole('button', { name: /gravar registo/i }).click();
    // Toast de sucesso
    await expect(page.locator('text=/registo inserido com sucesso/i')).toBeVisible({ timeout: 10000 });
  });

  test('4. Registo aparece na lista do dia após submissão', async ({ page }) => {
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill('08:00');
    await timeInputs.nth(1).fill('16:00');
    await page.getByRole('button', { name: /gravar registo/i }).click();
    await expect(page.locator('text=/registo inserido com sucesso/i')).toBeVisible({ timeout: 10000 });
    // Linha do dia mostra sumário colapsado com total de horas
    await expect(page.locator('text=/registradas/i').first()).toBeVisible({ timeout: 5000 });
  });
});
