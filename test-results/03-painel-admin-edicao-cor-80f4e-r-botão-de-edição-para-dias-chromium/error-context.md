# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 03-painel-admin\edicao-correcoes.spec.js >> Edição de Correções (Admin) >> Deve mostrar botão de edição para dias
- Location: tests\e2e\03-painel-admin\edicao-correcoes.spec.js:107:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('button:has-text("Correções")').or(locator('button:has-text("Corrections")'))

```

# Test source

```ts
  14  |       id: 'w_edit_test',
  15  |       name: 'TRABALHADOR TESTE',
  16  |       nif: '123456789',
  17  |       status: 'ativo',
  18  |     });
  19  | 
  20  |     testClient = createClient({
  21  |       id: 'c_edit_test',
  22  |       name: 'EMPRESA TESTE',
  23  |     });
  24  | 
  25  |     mockSupabase.data.workers = [testWorker];
  26  |     mockSupabase.data.clients = [testClient];
  27  | 
  28  |     const notification = createNotification({
  29  |       id: 'notif_edit_test',
  30  |       title: 'Pedido de Correção: EMPRESA TESTE',
  31  |       target_client_id: 'c_edit_test',
  32  |       target_type: 'admin',
  33  |       status: 'pending',
  34  |       payload: {
  35  |         reportType: 'precision',
  36  |         isFullMonth: false,
  37  |         changes: [
  38  |           {
  39  |             id: 'w_edit_test',
  40  |             name: 'TRABALHADOR TESTE',
  41  |             totalHours: 40,
  42  |             editedTotalHours: 42,
  43  |             dailyRecords: [
  44  |               {
  45  |                 date: '2026-05-01',
  46  |                 dateLabel: '01/05 (sex)',
  47  |                 entry: '08:00',
  48  |                 exit: '17:00',
  49  |                 breakStart: '12:00',
  50  |                 breakEnd: '13:00',
  51  |                 hours: 8,
  52  |                 editedEntry: '08:00',
  53  |                 editedExit: '18:00',
  54  |                 originalHours: 8,
  55  |                 editedHours: 9,
  56  |               },
  57  |               {
  58  |                 date: '2026-05-02',
  59  |                 dateLabel: '02/05 (sáb)',
  60  |                 entry: '08:00',
  61  |                 exit: '17:00',
  62  |                 breakStart: '12:00',
  63  |                 breakEnd: '13:00',
  64  |                 hours: 8,
  65  |                 editedEntry: null,
  66  |                 editedExit: null,
  67  |                 originalHours: 8,
  68  |                 editedHours: 8,
  69  |               },
  70  |             ],
  71  |           },
  72  |         ],
  73  |       },
  74  |     });
  75  | 
  76  |     mockSupabase.data.app_notifications = [notification];
  77  | 
  78  |     await page.goto('/');
  79  |     await page.waitForLoadState('networkidle');
  80  |   });
  81  | 
  82  |   test.afterEach(async ({ page }) => {
  83  |     await page.close();
  84  |   });
  85  | 
  86  |   test('Deve conseguir fazer login como admin', async ({ page }) => {
  87  |     await page.locator('input').first().fill('admin');
  88  |     await page.locator('input[type="password"]').fill('admin123');
  89  |     await page.click('button[type="submit"]');
  90  |     await page.waitForTimeout(1000);
  91  |   });
  92  | 
  93  |   test('Deve mostrar notificação de correção na lista', async ({ page }) => {
  94  |     await page.locator('input').first().fill('admin');
  95  |     await page.locator('input[type="password"]').fill('admin123');
  96  |     await page.click('button[type="submit"]');
  97  |     await page.waitForTimeout(1000);
  98  | 
  99  |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  100 |     await correcoesTab.click();
  101 |     await page.waitForTimeout(500);
  102 | 
  103 |     await expect(page.locator('text=EMPRESA TESTE')).toBeVisible();
  104 |     await expect(page.locator('text=TRABALHADOR TESTE')).toBeVisible();
  105 |   });
  106 | 
  107 |   test('Deve mostrar botão de edição para dias', async ({ page }) => {
  108 |     await page.locator('input').first().fill('admin');
  109 |     await page.locator('input[type="password"]').fill('admin123');
  110 |     await page.click('button[type="submit"]');
  111 |     await page.waitForTimeout(1000);
  112 | 
  113 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
> 114 |     await correcoesTab.click();
      |                        ^ Error: locator.click: Target page, context or browser has been closed
  115 |     await page.waitForTimeout(500);
  116 | 
  117 |     await page.locator('text=EMPRESA TESTE').click();
  118 |     await page.waitForTimeout(500);
  119 | 
  120 |     const editButton = page.locator('[data-testid="edit-day-btn"]').or(page.locator('button').filter({ has: page.locator('svg') }).nth(1));
  121 |     if (await editButton.isVisible()) {
  122 |       await expect(editButton).toBeVisible();
  123 |     }
  124 |   });
  125 | 
  126 |   test('Deve clicar no botão de edição e mostrar inputs', async ({ page }) => {
  127 |     await page.locator('input').first().fill('admin');
  128 |     await page.locator('input[type="password"]').fill('admin123');
  129 |     await page.click('button[type="submit"]');
  130 |     await page.waitForTimeout(1000);
  131 | 
  132 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  133 |     await correcoesTab.click();
  134 |     await page.waitForTimeout(500);
  135 | 
  136 |     await page.locator('text=EMPRESA TESTE').click();
  137 |     await page.waitForTimeout(500);
  138 | 
  139 |     const dayRow = page.locator('text=01/05').first();
  140 |     await dayRow.click();
  141 |     await page.waitForTimeout(300);
  142 | 
  143 |     const inputTime = page.locator('input[type="time"]').first();
  144 |     await expect(inputTime).toBeVisible();
  145 |   });
  146 | 
  147 |   test('BUG: Input deve manter valor digitado pelo admin', async ({ page }) => {
  148 |     await page.locator('input').first().fill('admin');
  149 |     await page.locator('input[type="password"]').fill('admin123');
  150 |     await page.click('button[type="submit"]');
  151 |     await page.waitForTimeout(1000);
  152 | 
  153 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  154 |     await correcoesTab.click();
  155 |     await page.waitForTimeout(500);
  156 | 
  157 |     await page.locator('text=EMPRESA TESTE').click();
  158 |     await page.waitForTimeout(500);
  159 | 
  160 |     const dayRow = page.locator('text=01/05').first();
  161 |     await dayRow.click();
  162 |     await page.waitForTimeout(300);
  163 | 
  164 |     const inputTime = page.locator('input[type="time"]').first();
  165 |     if (await inputTime.isVisible()) {
  166 |       await inputTime.fill('10:00');
  167 |       await page.waitForTimeout(200);
  168 | 
  169 |       const value = await inputTime.inputValue();
  170 |       expect(value).toBe('10:00');
  171 |     }
  172 |   });
  173 | 
  174 |   test('BUG: Botão de apagar deve limpar os valores', async ({ page }) => {
  175 |     await page.locator('input').first().fill('admin');
  176 |     await page.locator('input[type="password"]').fill('admin123');
  177 |     await page.click('button[type="submit"]');
  178 |     await page.waitForTimeout(1000);
  179 | 
  180 |     const correcoesTab = page.locator('button:has-text("Correções")').or(page.locator('button:has-text("Corrections")'));
  181 |     await correcoesTab.click();
  182 |     await page.waitForTimeout(500);
  183 | 
  184 |     await page.locator('text=EMPRESA TESTE').click();
  185 |     await page.waitForTimeout(500);
  186 | 
  187 |     const dayRow = page.locator('text=01/05').first();
  188 |     await dayRow.click();
  189 |     await page.waitForTimeout(300);
  190 | 
  191 |     const trashButton = page.locator('[title="Apagar valores"]').or(page.locator('button').filter({ has: page.locator('svg') }).last());
  192 |     if (await trashButton.isVisible()) {
  193 |       await trashButton.click();
  194 |       await page.waitForTimeout(200);
  195 |     }
  196 |   });
  197 | });
  198 | 
```