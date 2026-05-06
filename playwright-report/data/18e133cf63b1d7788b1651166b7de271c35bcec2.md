# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-fluxos-completos\cliente-admin-precision.spec.js >> Fluxo Completo: Cliente → Admin >> Fluxo rejeição: Admin rejeita correção com motivo
- Location: tests\e2e\04-fluxos-completos\cliente-admin-precision.spec.js:94:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Correções")').or(locator('button:has-text("Corrections")')) to be visible

```

# Test source

```ts
  38  |       target_client_id: 'c_flow_test',
  39  |       target_type: 'admin',
  40  |       status: 'pending',
  41  |       payload: {
  42  |         reportType: 'precision',
  43  |         isFullMonth: false,
  44  |         changes: [
  45  |           {
  46  |             id: 'w_flow_test',
  47  |             name: 'João Silva',
  48  |             totalHours: 40,
  49  |             editedTotalHours: 42,
  50  |             dailyRecords: [
  51  |               {
  52  |                 date: '2026-05-01',
  53  |                 dateLabel: '01/05 (sex)',
  54  |                 entry: '08:00',
  55  |                 exit: '17:00',
  56  |                 breakStart: '12:00',
  57  |                 breakEnd: '13:00',
  58  |                 hours: 8,
  59  |                 editedEntry: '08:00',
  60  |                 editedExit: '18:00',
  61  |                 originalHours: 8,
  62  |                 editedHours: 9,
  63  |               },
  64  |             ],
  65  |           },
  66  |         ],
  67  |       },
  68  |     });
  69  | 
  70  |     mockSupabase.data.app_notifications = [notification];
  71  | 
  72  |     await page.locator('input').first().fill('admin');
  73  |     await page.locator('input[type="password"]').fill('admin123');
  74  |     await page.click('button[type="submit"]');
  75  | 
  76  |     await page.waitForLoadState('networkidle').catch(() => {});
  77  |     await page.waitForTimeout(1500);
  78  | 
  79  |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  80  |     await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
  81  |     await correcoesTab.click();
  82  | 
  83  |     await page.waitForLoadState('networkidle').catch(() => {});
  84  | 
  85  |     await expect(page.locator('text=EMPRESA FLUXO')).toBeVisible({ timeout: 10000 });
  86  | 
  87  |     await page.locator('text=EMPRESA FLUXO').click();
  88  |     await page.waitForTimeout(500);
  89  | 
  90  |     await expect(page.locator('text=João Silva')).toBeVisible({ timeout: 5000 }).catch(() => {});
  91  |     await expect(page.locator('text=01/05')).toBeVisible({ timeout: 5000 }).catch(() => {});
  92  |   });
  93  | 
  94  |   test('Fluxo rejeição: Admin rejeita correção com motivo', async ({ page }) => {
  95  |     const notification = createNotification({
  96  |       id: 'notif_reject_001',
  97  |       title: 'Pedido de Correção: EMPRESA FLUXO',
  98  |       target_client_id: 'c_flow_test',
  99  |       target_type: 'admin',
  100 |       status: 'pending',
  101 |       payload: {
  102 |         reportType: 'precision',
  103 |         isFullMonth: false,
  104 |         changes: [
  105 |           {
  106 |             id: 'w_flow_test',
  107 |             name: 'João Silva',
  108 |             totalHours: 40,
  109 |             editedTotalHours: 42,
  110 |             dailyRecords: [
  111 |               {
  112 |                 date: '2026-05-01',
  113 |                 dateLabel: '01/05 (sex)',
  114 |                 entry: '08:00',
  115 |                 exit: '17:00',
  116 |                 hours: 8,
  117 |                 editedEntry: '08:00',
  118 |                 editedExit: '18:00',
  119 |                 originalHours: 8,
  120 |                 editedHours: 9,
  121 |               },
  122 |             ],
  123 |           },
  124 |         ],
  125 |       },
  126 |     });
  127 | 
  128 |     mockSupabase.data.app_notifications = [notification];
  129 | 
  130 |     await page.locator('input').first().fill('admin');
  131 |     await page.locator('input[type="password"]').fill('admin123');
  132 |     await page.click('button[type="submit"]');
  133 | 
  134 |     await page.waitForLoadState('networkidle').catch(() => {});
  135 |     await page.waitForTimeout(1500);
  136 | 
  137 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
> 138 |     await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
      |                        ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  139 |     await correcoesTab.click();
  140 | 
  141 |     await page.waitForLoadState('networkidle').catch(() => {});
  142 | 
  143 |     const empresaFluxo = page.locator('text=EMPRESA FLUXO');
  144 |     await empresaFluxo.waitFor({ state: 'visible', timeout: 10000 });
  145 |     await empresaFluxo.click();
  146 |     await page.waitForTimeout(500);
  147 | 
  148 |     const rejectButton = page.locator('button:has-text("Rejeitar")');
  149 |     if (await rejectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
  150 |       await rejectButton.click();
  151 |       await page.waitForTimeout(300);
  152 |     }
  153 |   });
  154 | 
  155 |   test('Quick Report mostra todos os dias do mês', async ({ page }) => {
  156 |     const quickNotification = createNotification({
  157 |       id: 'notif_quick_001',
  158 |       title: 'Divergência Reportada: EMPRESA FLUXO',
  159 |       target_client_id: 'c_flow_test',
  160 |       target_type: 'admin',
  161 |       status: 'pending',
  162 |       payload: {
  163 |         reportType: 'quick',
  164 |         isFullMonth: true,
  165 |         changes: [],
  166 |       },
  167 |       message: `💬 MENSAGEM DE DIVERGÊNCIA: EMPRESA FLUXO
  168 | 📅 Período: maio de 2026
  169 | 
  170 | 📊 RESUMO GERAL:
  171 | • Total Original: 160h
  172 | • Novo Total Sugerido: 160h
  173 | • Diferença: 0.00h
  174 | 
  175 | 👥 DETALHES POR COLABORADOR:
  176 | 
  177 | 👤 JOÃO SILVA [ID:w_flow_test]
  178 |    Total: 160h ➔ 160h (0.00h)
  179 |    Alterações:
  180 |    • 2026-05-01:
  181 |      - Turno: 08:00-17:00 ➔ 08:00-17:00
  182 |      - Pausa: 12:00-13:00 ➔ 12:00-13:00
  183 |      - Horas: 8h ➔ 8h
  184 | 
  185 | 💬 JUSTIFICAÇÃO:
  186 | "Confirmação mensal"`,
  187 |     });
  188 | 
  189 |     mockSupabase.data.app_notifications = [quickNotification];
  190 | 
  191 |     await page.locator('input').first().fill('admin');
  192 |     await page.locator('input[type="password"]').fill('admin123');
  193 |     await page.click('button[type="submit"]');
  194 | 
  195 |     await page.waitForLoadState('networkidle').catch(() => {});
  196 |     await page.waitForTimeout(1500);
  197 | 
  198 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  199 |     await correcoesTab.waitFor({ state: 'visible', timeout: 10000 });
  200 |     await correcoesTab.click();
  201 | 
  202 |     await page.waitForLoadState('networkidle').catch(() => {});
  203 | 
  204 |     const url = page.url();
  205 |     console.log('Admin URL after login:', url);
  206 |   });
  207 | });
```