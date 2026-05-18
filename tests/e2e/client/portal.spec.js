import { test, expect } from '@playwright/test';
import { CLIENT_ID, CLIENT_MONTH } from '../helpers/shared.js';

function portalUrl(clientId, month) {
  const params = new URLSearchParams({ view: 'client_portal', client: clientId });
  if (month) params.set('month', month);
  return `/?${params.toString()}`;
}

test.describe('Portal Cliente', () => {
  test.skip(!CLIENT_ID, 'PLAYWRIGHT_CLIENT_ID não definido em .env.playwright');

  test('1. URL do portal cliente carrega a página', async ({ page }) => {
    await page.goto(portalUrl(CLIENT_ID, CLIENT_MONTH));
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
  });

  test('2. Heading do período de validação está visível', async ({ page }) => {
    await page.goto(portalUrl(CLIENT_ID, CLIENT_MONTH));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('text=/relatório/i').or(page.locator('text=/período/i')).or(page.locator('text=/validação/i')).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('3. Secção de horas/relatório carrega com dados', async ({ page }) => {
    await page.goto(portalUrl(CLIENT_ID, CLIENT_MONTH));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('text=/horas/i').or(page.locator('text=/total/i')).or(page.locator('text=/trabalhador/i')).first()
    ).toBeVisible({ timeout: 20000 });
  });

  test('4. Botão de aprovação ou estado validado está visível', async ({ page }) => {
    await page.goto(portalUrl(CLIENT_ID, CLIENT_MONTH));
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('text=/validar e aprovar/i')
        .or(page.locator('text=/relatório validado/i'))
        .or(page.locator('text=/aprovado/i'))
        .first()
    ).toBeVisible({ timeout: 20000 });
  });
});
