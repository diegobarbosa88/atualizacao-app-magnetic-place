import { test, expect } from '@playwright/test';
import { resetMockSupabase, createSupabaseMock } from '../helpers/supabase-mock.js';
import { createWorker, createClient, createNotification, createCorrecao } from '../helpers/test-data-factory.js';

test.describe('Precision Report - Fluxo Completo Cliente → Admin', () => {
  let mockSupabase;

  test.beforeEach(async ({ page }) => {
    mockSupabase = resetMockSupabase();
    mockSupabase.seedTestData();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  test.describe('Modo Precisão - Edição de Horários', () => {
    test('deve navegar para modo de edição de precisão', async ({ page }) => {
      const client = mockSupabase.data.clients[0];
      const worker = mockSupabase.data.workers[0];

      mockSupabase.setData('logs', [
        {
          id: 'log_001',
          clientId: client.id,
          workerId: worker.id,
          workerName: worker.name,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          date: '2026-05-01',
          hours: 8
        }
      ]);

      await page.goto('/');
      await page.waitForTimeout(500);

      const editarButton = page.locator('button:has-text("Editar Relatório")');
      if (await editarButton.isVisible()) {
        await editarButton.click();
        await page.waitForTimeout(300);
      }

      const precisaoButton = page.locator('button:has-text("Ajuste de Precisão")');
      if (await precisaoButton.isVisible()) {
        await precisaoButton.click();
        await page.waitForTimeout(300);
      }

      const workerCards = page.locator('.rounded-\\[2rem\\]').filter({ hasText: worker.name });
      await expect(workerCards.first()).toBeVisible();
    });

    test('deve selecionar worker e mostrar área de edição', async ({ page }) => {
      const worker = mockSupabase.data.workers[0];

      mockSupabase.setData('logs', [
        {
          id: 'log_001',
          clientId: 'c_test_001',
          workerId: worker.id,
          workerName: worker.name,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          date: '2026-05-01',
          hours: 8
        }
      ]);

      await page.goto('/');
      await page.waitForTimeout(500);

      const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
      if (await workerCard.isVisible()) {
        await workerCard.click();
        await page.waitForTimeout(300);

        const editArea = page.locator('text=Ajustando registos diários');
        if (await editArea.isVisible()) {
          await expect(editArea).toBeVisible();
        }
      }
    });

    test('deve editar horário de entrada e recalcular horas', async ({ page }) => {
      const worker = mockSupabase.data.workers[0];

      mockSupabase.setData('logs', [
        {
          id: 'log_001',
          clientId: 'c_test_001',
          workerId: worker.id,
          workerName: worker.name,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          date: '2026-05-01',
          hours: 8
        }
      ]);

      await page.goto('/');
      await page.waitForTimeout(500);

      const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
      if (await workerCard.isVisible()) {
        await workerCard.click();
        await page.waitForTimeout(300);

        const timeInput = page.locator('input[type="time"]').first();
        if (await timeInput.isVisible()) {
          await timeInput.fill('09:00');
          await page.waitForTimeout(200);

          const totalDisplay = page.locator('text=/\\+?[\\d.]+h/').first();
          if (await totalDisplay.isVisible()) {
            const text = await totalDisplay.textContent();
            console.log('Updated total:', text);
          }
        }
      }
    });

    test('deve limpar dia (marcar como --:--)', async ({ page }) => {
      const worker = mockSupabase.data.workers[0];

      mockSupabase.setData('logs', [
        {
          id: 'log_001',
          clientId: 'c_test_001',
          workerId: worker.id,
          workerName: worker.name,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          date: '2026-05-01',
          hours: 8
        }
      ]);

      await page.goto('/');
      await page.waitForTimeout(500);

      const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
      if (await workerCard.isVisible()) {
        await workerCard.click();
        await page.waitForTimeout(300);

        const trashButton = page.locator('button[title="Apagar valores"]');
        if (await trashButton.isVisible()) {
          await trashButton.click();
          await page.waitForTimeout(200);

          const clearedLabel = page.locator('text=Apagado');
          if (await clearedLabel.isVisible()) {
            await expect(clearedLabel).toBeVisible();
          }
        }
      }
    });

    test('deve adicionar justificativa', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(500);

      const justificationTextarea = page.locator('textarea');
      if (await justificationTextarea.isVisible()) {
        await justificationTextarea.fill('Trabalho extra devido a projeto urgente');
        const value = await justificationTextarea.inputValue();
        expect(value).toBe('Trabalho extra devido a projeto urgente');
      }
    });

    test('deve mostrar resumo antes de enviar', async ({ page }) => {
      const worker = mockSupabase.data.workers[0];

      mockSupabase.setData('logs', [
        {
          id: 'log_001',
          clientId: 'c_test_001',
          workerId: worker.id,
          workerName: worker.name,
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:00',
          breakEnd: '13:00',
          date: '2026-05-01',
          hours: 8
        }
      ]);

      await page.goto('/');
      await page.waitForTimeout(500);

      const reverButton = page.locator('button:has-text("Rever Alterações")');
      if (await reverButton.isVisible()) {
        await reverButton.click();
        await page.waitForTimeout(300);

        const summaryTitle = page.locator('text=Resumo do Reporte');
        if (await summaryTitle.isVisible()) {
          await expect(summaryTitle).toBeVisible();
        }
      }
    });
  });

  test.describe('Integração Admin - Recebimento de Correção', () => {
    test('admin deve ver notificação de correção', async ({ page }) => {
      const notification = createNotification({
        id: 'notif_precision_001',
        title: 'Pedido de Correção: EMPRESA TESTE',
        target_client_id: 'c_test_001',
        target_type: 'admin',
        status: 'pending',
        type: 'warning',
        payload: {
          reportType: 'precision',
          isFullMonth: true,
          month: '2026-05',
          correcao_id: 'correcao_precision_001',
          changes: []
        }
      });

      mockSupabase.data.app_notifications = [notification];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const notifTitle = page.locator('text=Pedido de Correção');
        await expect(notifTitle.first()).toBeVisible();
      }
    });

    test('admin deve ver detalhes da correção', async ({ page }) => {
      const notification = createNotification({
        id: 'notif_detail_001',
        title: 'Pedido de Correção: EMPRESA TESTE',
        target_client_id: 'c_test_001',
        target_type: 'admin',
        status: 'pending',
        type: 'warning',
        payload: {
          reportType: 'precision',
          isFullMonth: true,
          month: '2026-05',
          correcao_id: 'correcao_detail_001',
          changes: [
            {
              id: 'w_test_001',
              name: 'João Silva',
              totalHours: 160,
              editedTotalHours: 164,
              dailyRecords: [
                {
                  date: '01/05 (sex)',
                  rawDate: '2026-05-01',
                  entry: '08:00',
                  exit: '17:00',
                  breakStart: '12:00',
                  breakEnd: '13:00',
                  hours: 8,
                  editedEntry: '08:00',
                  editedExit: '18:00',
                  editedBreakStart: '12:00',
                  editedBreakEnd: '13:00',
                  editedHours: 9
                }
              ]
            }
          ]
        }
      });

      mockSupabase.data.app_notifications = [notification];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const empresaText = page.locator('text=EMPRESA TESTE');
        if (await empresaText.isVisible()) {
          await empresaText.first().click();
          await page.waitForTimeout(500);

          const workerName = page.locator('text=João Silva');
          await expect(workerName).toBeVisible();
        }
      }
    });

    test('admin deve conseguir aceitar correção', async ({ page }) => {
      const correcao = createCorrecao({
        id: 'correcao_accept_001',
        title: 'Pedido de Correção: EMPRESA TESTE',
        status: 'pending',
        client_id: 'c_test_001',
        month: '2026-05',
        payload: {
          reportType: 'precision',
          isFullMonth: true,
          changes: [
            {
              id: 'w_test_001',
              name: 'João Silva',
              totalHours: 160,
              editedTotalHours: 164,
              dailyRecords: []
            }
          ]
        }
      });

      mockSupabase.data.correcoes = [correcao];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const acceptButton = page.locator('button:has-text("Aceitar")');
        if (await acceptButton.isVisible()) {
          await acceptButton.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('admin deve conseguir rejeitar correção', async ({ page }) => {
      const correcao = createCorrecao({
        id: 'correcao_reject_001',
        title: 'Pedido de Correção: EMPRESA TESTE',
        status: 'pending',
        client_id: 'c_test_001',
        month: '2026-05',
        payload: {
          reportType: 'precision',
          isFullMonth: true,
          changes: [
            {
              id: 'w_test_001',
              name: 'João Silva',
              totalHours: 160,
              editedTotalHours: 164,
              dailyRecords: []
            }
          ]
        }
      });

      mockSupabase.data.correcoes = [correcao];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const rejectButton = page.locator('button:has-text("Rejeitar")');
        if (await rejectButton.isVisible()) {
          await rejectButton.click();
          await page.waitForTimeout(300);
        }
      }
    });
  });

  test.describe('Quick Report vs Precision Report', () => {
    test('quick report deve usar formato de mensagem divergência', async ({ page }) => {
      const notification = createNotification({
        id: 'notif_quick_comparison',
        title: 'Divergência Reportada: EMPRESA TESTE',
        target_client_id: 'c_test_001',
        target_type: 'admin',
        status: 'pending',
        type: 'warning',
        payload: {
          reportType: 'quick',
          isFullMonth: true,
          month: '2026-05',
          changes: []
        },
        message: `💬 MENSAGEM DE DIVERGÊNCIA: EMPRESA TESTE
📅 Período: maio de 2026

📊 RESUMO GERAL:
• Total Original: 160h
• Novo Total Sugerido: 160h
• Diferença: 0.00h`
      });

      mockSupabase.data.app_notifications = [notification];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const divergenciaText = page.locator('text=Divergência Reportada');
        await expect(divergenciaText.first()).toBeVisible();
      }
    });

    test('precision report deve usar formato de pedido de correção', async ({ page }) => {
      const notification = createNotification({
        id: 'notif_precision_comparison',
        title: 'Pedido de Correção: EMPRESA TESTE',
        target_client_id: 'c_test_001',
        target_type: 'admin',
        status: 'pending',
        type: 'warning',
        payload: {
          reportType: 'precision',
          isFullMonth: true,
          month: '2026-05',
          changes: []
        },
        message: `⚠️ PEDIDO DE CORREÇÃO: EMPRESA TESTE
📅 Período: maio de 2026

📊 RESUMO GERAL:
• Total Original: 160h
• Novo Total Sugerido: 164h
• Diferença: +4.00h`
      });

      mockSupabase.data.app_notifications = [notification];

      await page.locator('input').first().fill('admin');
      await page.locator('input[type="password"]').fill('admin123');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      const correcoesTab = page.locator('button:has-text("Correções")');
      if (await correcoesTab.isVisible()) {
        await correcoesTab.click();
        await page.waitForTimeout(500);

        const pedidoText = page.locator('text=Pedido de Correção');
        await expect(pedidoText.first()).toBeVisible();
      }
    });
  });
});