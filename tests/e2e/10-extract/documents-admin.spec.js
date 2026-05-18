import { test, expect } from '@playwright/test';
import { setMockData, createTestWorker } from '../support/test-setup.js';

test.describe('DocumentsAdmin - Extracted Component', () => {
  test.beforeEach(async ({ page }) => {
    const worker = createTestWorker({ id: 'w_admin', name: 'Admin User', nif: 'admin123', status: 'ativo' });
    setMockData([worker], [], [], []);
  });

  test.skip('Deve renderizar secção de gestão de documentos', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Gestão de Documentos')).toBeVisible();
    await expect(page.locator('text=Upload de Novo Ficheiro (PDF)')).toBeVisible();
  });

  test.skip('Deve ter formulário de upload com seleccionador de colaborador', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    const workerSelect = page.locator('select').first();
    await expect(workerSelect).toBeVisible();
  });

  test.skip('Deve ter seleccionador de tipo de documento', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    const tipoSelect = page.locator('select').nth(1);
    await expect(tipoSelect).toBeVisible();
    await expect(page.locator('text=Recibo de Vencimento')).toBeVisible();
  });

  test.skip('Deve ter campo de pesquisa', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    await expect(page.locator('input[placeholder*="Pesquisar"]')).toBeVisible();
  });

  test.skip('Deve ter filtro de estado', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    const statusFilter = page.locator('select').nth(2);
    await expect(statusFilter).toBeVisible();
    await expect(page.locator('text=Todos os Estados')).toBeVisible();
    await expect(page.locator('text=Pendentes')).toBeVisible();
    await expect(page.locator('text=Assinados')).toBeVisible();
  });

  test.skip('Deve mostrar empty state quando não há documentos', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    await expect(page.locator('text=Sem documentos registados')).toBeVisible();
  });

  test.skip('Tabela deve ter colunas correctas', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    await expect(page.locator('th:has-text("Data")')).toBeVisible();
    await expect(page.locator('th:has-text("Colaborador")')).toBeVisible();
    await expect(page.locator('th:has-text("Tipo")')).toBeVisible();
    await expect(page.locator('th:has-text("Estado")')).toBeVisible();
    await expect(page.locator('th:has-text("Ação")')).toBeVisible();
  });

  test.skip('Botão de upload deve estar desabilitado sem selecionar ficheiro', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    await page.click('text=Documentos');
    await page.waitForTimeout(500);

    const submitBtn = page.locator('button:has-text("Submeter Documento")');
    await expect(submitBtn).toBeDisabled();
  });
});