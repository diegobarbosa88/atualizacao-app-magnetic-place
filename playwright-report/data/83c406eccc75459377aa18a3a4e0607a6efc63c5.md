# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-autenticacao\login.spec.js >> Autenticação >> Login worker com conta inativa
- Location: tests\e2e\01-autenticacao\login.spec.js:87:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=inativa')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=inativa')

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - img "Logo da Empresa" [ref=e8]
    - heading "MAGNETIC PLACE" [level=1] [ref=e9]
    - paragraph [ref=e10]: Acesso ao Sistema
  - generic [ref=e11]:
    - generic [ref=e12]:
      - text: Utilizador
      - generic [ref=e13]:
        - img [ref=e14]
        - 'textbox "ex: joaosilva" [ref=e18]': joãosilva
    - generic [ref=e19]:
      - text: Senha
      - generic [ref=e20]:
        - img [ref=e21]
        - textbox "O seu NIF" [ref=e24]: "987654321"
    - generic [ref=e25]:
      - img [ref=e26]
      - text: "Utilizador não encontrado (use o seu primeiro e último nome juntos, ex: joaosilva)"
    - button "Entrar" [active] [ref=e28] [cursor=pointer]
```

# Test source

```ts
  4   | test.describe('Autenticação', () => {
  5   |   test.beforeEach(async ({ page }) => {
  6   |     setMockData([], [], [], []);
  7   |   });
  8   | 
  9   |   test('Deve mostrar página de login', async ({ page }) => {
  10  |     await page.goto('/');
  11  |     await page.waitForLoadState('domcontentloaded');
  12  | 
  13  |     await expect(page.locator('h1')).toBeVisible();
  14  |     await expect(page.locator('input[placeholder*="joaosilva"]')).toBeVisible();
  15  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  16  |   });
  17  | 
  18  |   test('Login admin com credenciais válidas', async ({ page }) => {
  19  |     const adminWorker = createTestWorker({ id: 'w_admin', name: 'Admin', nif: 'admin123', status: 'ativo' });
  20  |     setMockData([adminWorker], [], [], []);
  21  | 
  22  |     await page.goto('/');
  23  |     await page.waitForLoadState('domcontentloaded');
  24  |     await page.locator('input').first().fill('admin');
  25  |     await page.locator('input[type="password"]').fill('admin123');
  26  |     await page.click('button[type="submit"]');
  27  |     await page.waitForTimeout(1500);
  28  | 
  29  |     const url = page.url();
  30  |     expect(url).not.toContain('login');
  31  |   });
  32  | 
  33  |   test('Login admin com credenciais inválidas', async ({ page }) => {
  34  |     setMockData([], [], [], []);
  35  | 
  36  |     await page.goto('/');
  37  |     await page.waitForLoadState('domcontentloaded');
  38  |     await page.locator('input').first().fill('admin');
  39  |     await page.locator('input[type="password"]').fill('wrongpassword');
  40  |     await page.click('button[type="submit"]');
  41  |     await page.waitForTimeout(1000);
  42  | 
  43  |     const errorMessage = page.locator('text=SENHA INCORRETA').or(page.locator('text=Utilizador não encontrado'));
  44  |     await expect(errorMessage).toBeVisible();
  45  |   });
  46  | 
  47  |   test('Login worker com credenciais válidas', async ({ page }) => {
  48  |     const worker = createTestWorker({
  49  |       id: 'w_worker_001',
  50  |       name: 'João Silva',
  51  |       nif: '987654321',
  52  |       status: 'ativo',
  53  |     });
  54  |     setMockData([worker], [], [], []);
  55  | 
  56  |     await page.goto('/');
  57  |     await page.waitForLoadState('domcontentloaded');
  58  |     await page.locator('input').first().fill('joaosilva');
  59  |     await page.locator('input[type="password"]').fill('987654321');
  60  |     await page.click('button[type="submit"]');
  61  |     await page.waitForTimeout(1500);
  62  | 
  63  |     const url = page.url();
  64  |     expect(url).not.toContain('login');
  65  |   });
  66  | 
  67  |   test('Login worker com NIF errado', async ({ page }) => {
  68  |     const worker = createTestWorker({
  69  |       id: 'w_worker_001',
  70  |       name: 'João Silva',
  71  |       nif: '123456789',
  72  |       status: 'ativo',
  73  |     });
  74  |     setMockData([worker], [], [], []);
  75  | 
  76  |     await page.goto('/');
  77  |     await page.waitForLoadState('domcontentloaded');
  78  |     await page.locator('input').first().fill('joaosilva');
  79  |     await page.locator('input[type="password"]').fill('wrongnif');
  80  |     await page.click('button[type="submit"]');
  81  |     await page.waitForTimeout(1000);
  82  | 
  83  |     const errorMessage = page.locator('text=SENHA INCORRETA').or(page.locator('text=Utilizador não encontrado'));
  84  |     await expect(errorMessage).toBeVisible();
  85  |   });
  86  | 
  87  |   test('Login worker com conta inativa', async ({ page }) => {
  88  |     const worker = createTestWorker({
  89  |       id: 'w_worker_001',
  90  |       name: 'João Silva',
  91  |       nif: '987654321',
  92  |       status: 'inativo',
  93  |     });
  94  |     setMockData([worker], [], [], []);
  95  | 
  96  |     await page.goto('/');
  97  |     await page.waitForLoadState('domcontentloaded');
  98  |     await page.locator('input').first().fill('joãosilva');
  99  |     await page.locator('input[type="password"]').fill('987654321');
  100 |     await page.click('button[type="submit"]');
  101 |     await page.waitForTimeout(1000);
  102 | 
  103 |     const errorMessage = page.locator('text=inativa');
> 104 |     await expect(errorMessage).toBeVisible();
      |                                ^ Error: expect(locator).toBeVisible() failed
  105 |   });
  106 | });
```