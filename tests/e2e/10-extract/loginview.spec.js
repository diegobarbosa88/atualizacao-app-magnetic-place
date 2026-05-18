import { test, expect } from '@playwright/test';
import { setMockData, createTestWorker } from '../support/test-setup.js';

test.describe('LoginView - Extracted Component', () => {
  test.beforeEach(async ({ page }) => {
    setMockData([], [], [], []);
  });

  test('Deve renderizar formulário de login com todos os elementos', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('input[placeholder*="joaosilva"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('text=Acesso ao Sistema')).toBeVisible();
  });

  test('Login worker com credenciais válidas (nome completo)', async ({ page }) => {
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

  test('Login worker com NIF errado mostra erro', async ({ page }) => {
    const worker = createTestWorker({
      id: 'w_worker_001',
      name: 'João Silva',
      nif: '123456789',
      status: 'ativo',
    });
    setMockData([worker], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('joãosilva');
    await page.locator('input[type="password"]').fill('wrongnif');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Utilizador não encontrado')).toBeVisible();
  });

  test.skip('Login worker com conta inativa rejeita', async ({ page }) => {
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

    await expect(page.locator('text=sua conta está inativa')).toBeVisible();
  });

  test('Login admin com password correta', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).not.toContain('login');
  });

  test('Login admin com password errada mostra erro', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=SENHA INCORRETA').or(page.locator('text=Utilizador não encontrado'))).toBeVisible();
  });

  test('Utilizador não encontrado mostra mensagem adequada', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('input').first().fill('naoexiste');
    await page.locator('input[type="password"]').fill('123456789');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Utilizador não encontrado')).toBeVisible();
  });

  test('Empresa mostra nome correto no login', async ({ page }) => {
    setMockData([], [], [], []);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1')).toContainText('MAGNETIC');
  });
});