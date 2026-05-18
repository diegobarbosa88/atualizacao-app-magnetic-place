import { test, expect } from '@playwright/test';
import { setMockData, createTestWorker } from '../support/test-setup.js';

test.describe('Autenticação', () => {
  test.beforeEach(async ({ page }) => {
    setMockData([], [], [], []);
  });

  test('Deve mostrar página de login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder*="joaosilva"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Login admin com credenciais válidas', async ({ page }) => {
    const adminWorker = createTestWorker({ id: 'w_admin', name: 'Admin', nif: 'admin123', status: 'ativo' });
    setMockData([adminWorker], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).not.toContain('login');
  });

  test('Login admin com credenciais inválidas', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const errorMessage = page.locator('text=SENHA INCORRETA').or(page.locator('text=Utilizador não encontrado'));
    await expect(errorMessage).toBeVisible();
  });

  test('Login worker com credenciais válidas', async ({ page }) => {
    const worker = createTestWorker({
      id: 'w_worker_001',
      name: 'João Silva',
      nif: '987654321',
      status: 'ativo',
    });
    setMockData([worker], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('joaosilva');
    await page.locator('input[type="password"]').fill('987654321');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).not.toContain('login');
  });

  test('Login worker com NIF errado', async ({ page }) => {
    const worker = createTestWorker({
      id: 'w_worker_001',
      name: 'João Silva',
      nif: '123456789',
      status: 'ativo',
    });
    setMockData([worker], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('joaosilva');
    await page.locator('input[type="password"]').fill('wrongnif');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const errorMessage = page.locator('text=SENHA INCORRETA').or(page.locator('text=Utilizador não encontrado'));
    await expect(errorMessage).toBeVisible();
  });

  test('Login worker com conta inativa', async ({ page }) => {
    const worker = createTestWorker({
      id: 'w_worker_001',
      name: 'João Silva',
      nif: '987654321',
      status: 'inativo',
    });
    setMockData([worker], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('joãosilva');
    await page.locator('input[type="password"]').fill('987654321');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const errorMessage = page.locator('text=inativa');
    await expect(errorMessage).toBeVisible();
  });
});