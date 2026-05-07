import { test, expect } from '@playwright/test';
import { setMockData, createTestWorker } from '../support/test-setup.js';

test.describe('AdminDashboard - Extracted Component', () => {
  test.beforeEach(async ({ page }) => {
    const worker = createTestWorker({ id: 'w_admin', name: 'Admin User', nif: 'admin123', status: 'ativo' });
    setMockData([worker], [], [], []);
  });

  test.skip('Deve renderizar dashboard após login admin', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Dashboard Geral')).toBeVisible();
  });

  test.skip('Deve ter menu de navegação com todas as tabs', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await expect(page.locator('button:has-text("Geral")')).toBeVisible();
    await expect(page.locator('button:has-text("Equipa")')).toBeVisible();
    await expect(page.locator('button:has-text("Clientes")')).toBeVisible();
  });

  test.skip('Deve navegar para tab Equipa', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('button:has-text("Equipa")');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Gestão de Equipa')).toBeVisible();
  });

  test.skip('Deve navegar para tab Clientes', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('button:has-text("Clientes")');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Gestão de Clientes')).toBeVisible();
  });

  test.skip('Deve mostrar stats no overview', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await expect(page.locator('text=Horas Totais')).toBeVisible();
    await expect(page.locator('text=Faturação Estimada')).toBeVisible();
    await expect(page.locator('text=Custos Globais')).toBeVisible();
    await expect(page.locator('text=Resultado Líquido')).toBeVisible();
  });

  test.skip('Deve ter botão de logout', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const logoutBtn = page.locator('button[title="Sair"]');
    await expect(logoutBtn).toBeVisible();
  });

  test.skip('Deve ter botão de relatório financeiro', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await expect(page.locator('button:has-text("Financeiro")')).toBeVisible();
  });

  test.skip('Navegação mostra tab activa correctamente', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const overviewTab = page.locator('button:has-text("Geral")');
    await expect(overviewTab).toHaveClass(/bg-white/);
  });
});