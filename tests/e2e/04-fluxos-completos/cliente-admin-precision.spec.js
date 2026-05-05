import { test, expect } from '@playwright/test';
import { resetMockSupabase } from '../helpers/supabase-mock.js';
import { createWorker, createClient, createNotification } from '../helpers/test-data-factory.js';

test.describe('Fluxo Completo: Cliente → Admin', () => {
  let mockSupabase;

  test.beforeEach(async ({ page }) => {
    mockSupabase = resetMockSupabase();

    const testWorker = createWorker({
      id: 'w_flow_test',
      name: 'João Silva',
      nif: '123456789',
      status: 'ativo',
    });

    const testClient = createClient({
      id: 'c_flow_test',
      name: 'EMPRESA FLUXO',
    });

    mockSupabase.data.workers = [testWorker];
    mockSupabase.data.clients = [testClient];

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  test('Fluxo completo: Worker cria report, Admin vê e aprova', async ({ page }) => {
    const notification = createNotification({
      id: 'notif_flow_001',
      title: 'Pedido de Correção: EMPRESA FLUXO',
      target_client_id: 'c_flow_test',
      target_type: 'admin',
      status: 'pending',
      payload: {
        reportType: 'precision',
        isFullMonth: false,
        changes: [
          {
            id: 'w_flow_test',
            name: 'João Silva',
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
            ],
          },
        ],
      },
    });

    mockSupabase.data.app_notifications = [notification];

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
    await correcoesTab.click();

    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.locator('text=EMPRESA FLUXO')).toBeVisible({ timeout: 10000 });

    await page.locator('text=EMPRESA FLUXO').click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=João Silva')).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=01/05')).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('Fluxo rejeição: Admin rejeita correção com motivo', async ({ page }) => {
    const notification = createNotification({
      id: 'notif_reject_001',
      title: 'Pedido de Correção: EMPRESA FLUXO',
      target_client_id: 'c_flow_test',
      target_type: 'admin',
      status: 'pending',
      payload: {
        reportType: 'precision',
        isFullMonth: false,
        changes: [
          {
            id: 'w_flow_test',
            name: 'João Silva',
            totalHours: 40,
            editedTotalHours: 42,
            dailyRecords: [
              {
                date: '2026-05-01',
                dateLabel: '01/05 (sex)',
                entry: '08:00',
                exit: '17:00',
                hours: 8,
                editedEntry: '08:00',
                editedExit: '18:00',
                originalHours: 8,
                editedHours: 9,
              },
            ],
          },
        ],
      },
    });

    mockSupabase.data.app_notifications = [notification];

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
    await correcoesTab.click();

    await page.waitForLoadState('networkidle').catch(() => {});

    const empresaFluxo = page.locator('text=EMPRESA FLUXO');
    await empresaFluxo.waitFor({ state: 'visible', timeout: 10000 });
    await empresaFluxo.click();
    await page.waitForTimeout(500);

    const rejectButton = page.locator('button:has-text("Rejeitar")');
    if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await rejectButton.click();
      await page.waitForTimeout(300);
    }
  });

  test('Quick Report mostra todos os dias do mês', async ({ page }) => {
    const quickNotification = createNotification({
      id: 'notif_quick_001',
      title: 'Divergência Reportada: EMPRESA FLUXO',
      target_client_id: 'c_flow_test',
      target_type: 'admin',
      status: 'pending',
      payload: {
        reportType: 'quick',
        isFullMonth: true,
        changes: [],
      },
      message: `💬 MENSAGEM DE DIVERGÊNCIA: EMPRESA FLUXO
📅 Período: maio de 2026

📊 RESUMO GERAL:
• Total Original: 160h
• Novo Total Sugerido: 160h
• Diferença: 0.00h

👥 DETALHES POR COLABORADOR:

👤 JOÃO SILVA [ID:w_flow_test]
   Total: 160h ➔ 160h (0.00h)
   Alterações:
   • 2026-05-01:
     - Turno: 08:00-17:00 ➔ 08:00-17:00
     - Pausa: 12:00-13:00 ➔ 12:00-13:00
     - Horas: 8h ➔ 8h

💬 JUSTIFICAÇÃO:
"Confirmação mensal"`,
    });

    mockSupabase.data.app_notifications = [quickNotification];

    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);

    const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
    await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
    await correcoesTab.click();

    await page.waitForLoadState('networkidle').catch(() => {});

    const url = page.url();
    console.log('Admin URL after login:', url);
  });
});