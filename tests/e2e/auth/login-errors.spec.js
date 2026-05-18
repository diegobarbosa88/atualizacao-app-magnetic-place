import { test, expect } from '@playwright/test';
import { WORKER_USERNAME } from '../helpers/shared.js';

test.describe('Login — Validação de Credenciais', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('1. Password errada mostra mensagem de erro', async ({ page }) => {
    // Precisa de um utilizador que existe — usa WORKER_USERNAME com password errada
    test.skip(!WORKER_USERNAME, 'PLAYWRIGHT_WORKER_USERNAME não definido em .env.playwright');
    await page.locator('input').first().fill(WORKER_USERNAME);
    await page.locator('input[type="password"]').fill('senhaerrada_999');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=/senha incorreta/i')).toBeVisible({ timeout: 10000 });
  });

  test('2. Utilizador inexistente mostra mensagem de erro', async ({ page }) => {
    await page.locator('input').first().fill('utilizadorquenaoexiste');
    await page.locator('input[type="password"]').fill('123456789');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=/utilizador não encontrado/i')).toBeVisible({ timeout: 10000 });
  });

  test('3. Campos vazios não submetem o formulário', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(500);
    // Deve continuar na página de login — heading visível
    await expect(page.locator('text=/acesso ao sistema/i')).toBeVisible();
  });

  test('4. Erro desaparece ao começar a escrever novo utilizador', async ({ page }) => {
    // Provocar erro
    await page.locator('input').first().fill('errado');
    await page.locator('input[type="password"]').fill('errado');
    await page.locator('button[type="submit"]').click();
    await expect(
      page.locator('text=/utilizador não encontrado/i').or(page.locator('text=/senha incorreta/i')).first()
    ).toBeVisible({ timeout: 10000 });
    // Começar a escrever no campo utilizador
    await page.locator('input').first().fill('');
    await page.locator('input').first().type('a');
    // Mensagem de erro deve desaparecer
    await expect(
      page.locator('text=/utilizador não encontrado/i').or(page.locator('text=/senha incorreta/i')).first()
    ).not.toBeVisible({ timeout: 3000 });
  });
});
