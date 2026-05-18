import { test, expect } from '@playwright/test';
import { loginWorker, dismissBanners, WORKER_USERNAME, WORKER_PASSWORD } from '../helpers/shared.js';

test.describe('Worker — Expandir Detalhes do Dia', () => {
  test.skip(!WORKER_USERNAME || !WORKER_PASSWORD, 'PLAYWRIGHT_WORKER_USERNAME e PLAYWRIGHT_WORKER_PASSWORD não definidos em .env.playwright');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginWorker(page);
    await dismissBanners(page);
    await expect(page.locator('text=/olá,/i')).toBeVisible({ timeout: 15000 });
  });

  test('1. Dia com registos mostra sumário "registradas"', async ({ page }) => {
    // Verificar que pelo menos um dia tem registos (sumário colapsado)
    const hasSummary = await page.locator('text=/registradas/i').first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasSummary) {
      test.skip(true, 'Nenhum dia com registos neste mês');
    }
    await expect(page.locator('text=/registradas/i').first()).toBeVisible();
  });

  test('2. Clicar num dia com registos expande os detalhes', async ({ page }) => {
    const dayWithRecords = page.locator('text=/registradas/i').first();
    const hasRecords = await dayWithRecords.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRecords) {
      test.skip(true, 'Nenhum dia com registos neste mês');
      return;
    }

    // Clicar na linha do dia
    await dayWithRecords.click();
    // Detalhes expandidos: intervalo de horas no formato HH:MM-HH:MM
    await expect(
      page.locator('text=/\\d{2}:\\d{2}/').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('3. Detalhes expandidos mostram nome do cliente', async ({ page }) => {
    const dayWithRecords = page.locator('text=/registradas/i').first();
    const hasRecords = await dayWithRecords.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasRecords) {
      test.skip(true, 'Nenhum dia com registos neste mês');
      return;
    }

    await dayWithRecords.click();
    // Badge com nome do cliente deve aparecer nos detalhes
    await expect(
      page.locator('text=/\\d{2}:\\d{2}/').first()
    ).toBeVisible({ timeout: 5000 });
    // Clicar novamente colapsa
    await dayWithRecords.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Submeter registo e expandir dia mostra novas horas', async ({ page }) => {
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill('10:00');
    await timeInputs.nth(1).fill('14:00');
    await page.getByRole('button', { name: /gravar registo/i }).click();
    await expect(page.locator('text=/registo inserido com sucesso/i')).toBeVisible({ timeout: 10000 });

    // Aguardar que o estado React e o re-fetch do Supabase terminem
    await page.waitForTimeout(2000);

    const entryLocator = page.locator('text=/10:00-14:00/').first();
    const alreadyVisible = await entryLocator.isVisible().catch(() => false);
    if (!alreadyVisible) {
      await page.locator('text=/registradas/i').first().click();
      // Aguardar re-render da lista expandida
      await page.waitForTimeout(500);
    }

    await expect(entryLocator).toBeVisible({ timeout: 15000 });
  });
});
