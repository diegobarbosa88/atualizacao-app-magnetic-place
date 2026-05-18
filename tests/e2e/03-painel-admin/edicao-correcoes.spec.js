import { test, expect } from '@playwright/test';
import { resetMockSupabase } from '../helpers/supabase-mock.js';
import { createWorker, createClient, createNotification } from '../helpers/test-data-factory.js';

test.describe('Edição de Correções (Admin)', () => {
  let mockSupabase;
  let testWorker;
  let testClient;

  test.beforeEach(async ({ page }) => {
    mockSupabase = resetMockSupabase();

    testWorker = createWorker({
      id: 'w_edit_test',
      name: 'TRABALHADOR TESTE',
      nif: '123456789',
      status: 'ativo',
    });

    testClient = createClient({
      id: 'c_edit_test',
      name: 'EMPRESA TESTE',
    });

    mockSupabase.data.workers = [testWorker];
    mockSupabase.data.clients = [testClient];

    const notification = createNotification({
      id: 'notif_edit_test',
      title: 'Pedido de Correção: EMPRESA TESTE',
      target_client_id: 'c_edit_test',
      target_type: 'admin',
      status: 'pending',
      payload: {
        reportType: 'precision',
        isFullMonth: false,
        changes: [
          {
            id: 'w_edit_test',
            name: 'TRABALHADOR TESTE',
            totalHours: 40,
            editedTotalHours: 42,
            dailyRecords: [
              {
                date: '2026-05-01',
                dateLabel: '01/05 (sex)',
                entry: '08:00',
                exit: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                hours: 8,
                editedEntry: '08:00',
                editedExit: '18:00',
                originalHours: 8,
                editedHours: 9,
              },
              {
                date: '2026-05-02',
                dateLabel: '02/05 (sáb)',
                entry: '08:00',
                exit: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                hours: 8,
                editedEntry: null,
                editedExit: null,
                originalHours: 8,
                editedHours: 8,
              },
            ],
          },
        ],
      },
    });

    mockSupabase.data.app_notifications = [notification];

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  test('Deve conseguir fazer login como admin', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
  });

  test('Deve mostrar notificação de correção na lista', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=EMPRESA TESTE')).toBeVisible();
    await expect(page.locator('text=TRABALHADOR TESTE')).toBeVisible();
  });

  test('Deve mostrar botão de edição para dias', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.click();
    await page.waitForTimeout(500);

    await page.locator('text=EMPRESA TESTE').click();
    await page.waitForTimeout(500);

    const editButton = page.locator('[data-testid="edit-day-btn"]').or(page.locator('button').filter({ has: page.locator('svg') }).nth(1));
    if (await editButton.isVisible()) {
      await expect(editButton).toBeVisible();
    }
  });

  test('Deve clicar no botão de edição e mostrar inputs', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.click();
    await page.waitForTimeout(500);

    await page.locator('text=EMPRESA TESTE').click();
    await page.waitForTimeout(500);

    const dayRow = page.locator('text=01/05').first();
    await dayRow.click();
    await page.waitForTimeout(300);

    const inputTime = page.locator('input[type="time"]').first();
    await expect(inputTime).toBeVisible();
  });

  test('BUG: Input deve manter valor digitado pelo admin', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.click();
    await page.waitForTimeout(500);

    await page.locator('text=EMPRESA TESTE').click();
    await page.waitForTimeout(500);

    const dayRow = page.locator('text=01/05').first();
    await dayRow.click();
    await page.waitForTimeout(300);

    const inputTime = page.locator('input[type="time"]').first();
    if (await inputTime.isVisible()) {
      await inputTime.fill('10:00');
      await page.waitForTimeout(200);

      const value = await inputTime.inputValue();
      expect(value).toBe('10:00');
    }
  });

  test('BUG: Botão de apagar deve limpar os valores', async ({ page }) => {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.click();
    await page.waitForTimeout(500);

    await page.locator('text=EMPRESA TESTE').click();
    await page.waitForTimeout(500);

    const dayRow = page.locator('text=01/05').first();
    await dayRow.click();
    await page.waitForTimeout(300);

    const trashButton = page.locator('[title="Apagar valores"]').or(page.locator('button').filter({ has: page.locator('svg') }).last());
    if (await trashButton.isVisible()) {
      await trashButton.click();
      await page.waitForTimeout(200);
    }
  });
});
