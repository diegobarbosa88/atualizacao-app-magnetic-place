import { test, expect } from '@playwright/test';
import { setMockData, createTestWorker } from '../support/test-setup.js';

test.describe('NotificationsAdmin - Extracted Component', () => {
  test.beforeEach(async ({ page }) => {
    const worker = createTestWorker({ id: 'w_admin', name: 'Admin User', nif: 'admin123', status: 'ativo' });
    setMockData([worker], [], [], []);
  });

  test.skip('Deve renderizar secção de gestão de avisos', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Gestão de Banners de Aviso')).toBeVisible();
    await expect(page.locator('text=Criar Novo Aviso')).toBeVisible();
  });

  test.skip('Deve criar aviso com título e mensagem', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Avisos Existentes')).toBeVisible();
  });

  test.skip('Deve mostrar controlo de público-alvo (todos vs específico)', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    const targetSelect = page.locator('select').first();
    await expect(targetSelect).toBeVisible();
  });

  test.skip('Deve ter opções para diferentes tipos de aviso', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    const typeSelect = page.locator('select').nth(1);
    await expect(typeSelect).toBeVisible();
    await expect(page.locator('text=Informação (Azul)')).toBeVisible();
    await expect(page.locator('text=Aviso (Laranja)')).toBeVisible();
  });

  test.skip('Deve mostrar empty state quando não há avisos', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Nenhum aviso criado')).toBeVisible();
  });

  test.skip('Deve ter botão para criar aviso', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Notificações');
    await page.waitForTimeout(500);

    await expect(page.locator('button:has-text("Criar Aviso no App")')).toBeVisible();
  });
});