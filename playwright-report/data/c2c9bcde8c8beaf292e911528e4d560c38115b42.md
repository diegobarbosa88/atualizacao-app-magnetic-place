# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 05-fluxos-completos\precision-report.spec.js >> Precision Report - Fluxo Completo Cliente → Admin >> Modo Precisão - Edição de Horários >> deve navegar para modo de edição de precisão
- Location: tests\e2e\05-fluxos-completos\precision-report.spec.js:20:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rounded-\\[2rem\\]').filter({ hasText: 'João Silva' }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('.rounded-\\[2rem\\]').filter({ hasText: 'João Silva' }).first()

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { resetMockSupabase, createSupabaseMock } from '../helpers/supabase-mock.js';
  3   | import { createWorker, createClient, createNotification, createCorrecao } from '../helpers/test-data-factory.js';
  4   | 
  5   | test.describe('Precision Report - Fluxo Completo Cliente → Admin', () => {
  6   |   let mockSupabase;
  7   | 
  8   |   test.beforeEach(async ({ page }) => {
  9   |     mockSupabase = resetMockSupabase();
  10  |     mockSupabase.seedTestData();
  11  |     await page.goto('/');
  12  |     await page.waitForLoadState('networkidle');
  13  |   });
  14  | 
  15  |   test.afterEach(async ({ page }) => {
  16  |     await page.close();
  17  |   });
  18  | 
  19  |   test.describe('Modo Precisão - Edição de Horários', () => {
  20  |     test('deve navegar para modo de edição de precisão', async ({ page }) => {
  21  |       const client = mockSupabase.data.clients[0];
  22  |       const worker = mockSupabase.data.workers[0];
  23  | 
  24  |       mockSupabase.setData('logs', [
  25  |         {
  26  |           id: 'log_001',
  27  |           clientId: client.id,
  28  |           workerId: worker.id,
  29  |           workerName: worker.name,
  30  |           startTime: '08:00',
  31  |           endTime: '17:00',
  32  |           breakStart: '12:00',
  33  |           breakEnd: '13:00',
  34  |           date: '2026-05-01',
  35  |           hours: 8
  36  |         }
  37  |       ]);
  38  | 
  39  |       await page.goto('/');
  40  |       await page.waitForTimeout(500);
  41  | 
  42  |       const editarButton = page.locator('button:has-text("Editar Relatório")');
  43  |       if (await editarButton.isVisible()) {
  44  |         await editarButton.click();
  45  |         await page.waitForTimeout(300);
  46  |       }
  47  | 
  48  |       const precisaoButton = page.locator('button:has-text("Ajuste de Precisão")');
  49  |       if (await precisaoButton.isVisible()) {
  50  |         await precisaoButton.click();
  51  |         await page.waitForTimeout(300);
  52  |       }
  53  | 
  54  |       const workerCards = page.locator('.rounded-\\[2rem\\]').filter({ hasText: worker.name });
> 55  |       await expect(workerCards.first()).toBeVisible();
      |                                         ^ Error: expect(locator).toBeVisible() failed
  56  |     });
  57  | 
  58  |     test('deve selecionar worker e mostrar área de edição', async ({ page }) => {
  59  |       const worker = mockSupabase.data.workers[0];
  60  | 
  61  |       mockSupabase.setData('logs', [
  62  |         {
  63  |           id: 'log_001',
  64  |           clientId: 'c_test_001',
  65  |           workerId: worker.id,
  66  |           workerName: worker.name,
  67  |           startTime: '08:00',
  68  |           endTime: '17:00',
  69  |           breakStart: '12:00',
  70  |           breakEnd: '13:00',
  71  |           date: '2026-05-01',
  72  |           hours: 8
  73  |         }
  74  |       ]);
  75  | 
  76  |       await page.goto('/');
  77  |       await page.waitForTimeout(500);
  78  | 
  79  |       const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
  80  |       if (await workerCard.isVisible()) {
  81  |         await workerCard.click();
  82  |         await page.waitForTimeout(300);
  83  | 
  84  |         const editArea = page.locator('text=Ajustando registos diários');
  85  |         if (await editArea.isVisible()) {
  86  |           await expect(editArea).toBeVisible();
  87  |         }
  88  |       }
  89  |     });
  90  | 
  91  |     test('deve editar horário de entrada e recalcular horas', async ({ page }) => {
  92  |       const worker = mockSupabase.data.workers[0];
  93  | 
  94  |       mockSupabase.setData('logs', [
  95  |         {
  96  |           id: 'log_001',
  97  |           clientId: 'c_test_001',
  98  |           workerId: worker.id,
  99  |           workerName: worker.name,
  100 |           startTime: '08:00',
  101 |           endTime: '17:00',
  102 |           breakStart: '12:00',
  103 |           breakEnd: '13:00',
  104 |           date: '2026-05-01',
  105 |           hours: 8
  106 |         }
  107 |       ]);
  108 | 
  109 |       await page.goto('/');
  110 |       await page.waitForTimeout(500);
  111 | 
  112 |       const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
  113 |       if (await workerCard.isVisible()) {
  114 |         await workerCard.click();
  115 |         await page.waitForTimeout(300);
  116 | 
  117 |         const timeInput = page.locator('input[type="time"]').first();
  118 |         if (await timeInput.isVisible()) {
  119 |           await timeInput.fill('09:00');
  120 |           await page.waitForTimeout(200);
  121 | 
  122 |           const totalDisplay = page.locator('text=/\\+?[\\d.]+h/').first();
  123 |           if (await totalDisplay.isVisible()) {
  124 |             const text = await totalDisplay.textContent();
  125 |             console.log('Updated total:', text);
  126 |           }
  127 |         }
  128 |       }
  129 |     });
  130 | 
  131 |     test('deve limpar dia (marcar como --:--)', async ({ page }) => {
  132 |       const worker = mockSupabase.data.workers[0];
  133 | 
  134 |       mockSupabase.setData('logs', [
  135 |         {
  136 |           id: 'log_001',
  137 |           clientId: 'c_test_001',
  138 |           workerId: worker.id,
  139 |           workerName: worker.name,
  140 |           startTime: '08:00',
  141 |           endTime: '17:00',
  142 |           breakStart: '12:00',
  143 |           breakEnd: '13:00',
  144 |           date: '2026-05-01',
  145 |           hours: 8
  146 |         }
  147 |       ]);
  148 | 
  149 |       await page.goto('/');
  150 |       await page.waitForTimeout(500);
  151 | 
  152 |       const workerCard = page.locator('button').filter({ hasText: worker.name }).first();
  153 |       if (await workerCard.isVisible()) {
  154 |         await workerCard.click();
  155 |         await page.waitForTimeout(300);
```