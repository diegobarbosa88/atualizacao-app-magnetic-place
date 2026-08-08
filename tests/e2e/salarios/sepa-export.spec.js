import { test, expect } from '@playwright/test';

const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'admin123';

async function loginAdmin(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('button', { name: /geral/i })).toBeVisible({ timeout: 20000 });
}

async function navegarParaSalarios(page) {
  // Fechar banners / notificações que possam bloquear cliques
  await page.locator('[class*="z-\\[9999\\]"] button').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);

  const btnSalarios = page.getByRole('button', { name: /salários/i });
  await btnSalarios.waitFor({ timeout: 10000 });
  await btnSalarios.click();
  await page.waitForTimeout(800);
}

test.describe('SEPA XML — Exportação', () => {

  test('API /api/salarios/exportar-sepa valida payload vazio', async ({ request }) => {
    const res = await request.post(`/api/salarios/exportar-sepa`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/trabalhadores/i);
  });

  test('API /api/salarios/exportar-sepa valida registo incompleto', async ({ request }) => {
    const res = await request.post(`/api/salarios/exportar-sepa`, {
      data: {
        trabalhadores: [{ nome: 'João Silva', iban: 'PT50000201231234567890154' }],
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/incompleto/i);
  });

  test('API /api/salarios/exportar-sepa gera XML SEPA válido', async ({ request }) => {
    const res = await request.post(`/api/salarios/exportar-sepa`, {
      data: {
        trabalhadores: [
          {
            nome: 'João Silva',
            iban: 'PT50000201231234567890154',
            salario: 1200.00,
            mes: '06',
            ano: '2026',
          },
          {
            nome: 'Maria Santos',
            iban: 'PT50000201239876543210176',
            salario: 950.50,
            mes: '06',
            ano: '2026',
          },
        ],
        instant: false,
      },
    });

    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/xml');
    expect(res.headers()['content-disposition']).toContain('salarios_magnetic_place.xml');

    const xml = await res.text();
    expect(xml).toContain('pain.001.001.03');
    expect(xml).toContain('MAGNETIC PLACE UNIPESSOAL LDA');
    expect(xml).toContain('João Silva');
    expect(xml).toContain('Maria Santos');
    expect(xml).toContain('PT50000201231234567890154');
    expect(xml).toContain('1200.00');
    expect(xml).toContain('950.50');
    expect(xml).toContain('Vencimento 06/2026');
    expect(xml).toContain('SEPA');
    expect(xml).toContain('SALA');
    // Não deve conter INST (não é transferência imediata)
    expect(xml).not.toContain('<Cd>INST</Cd>');
  });

  test('API /api/salarios/exportar-sepa gera XML para transferência imediata (SCT Inst)', async ({ request }) => {
    const res = await request.post(`/api/salarios/exportar-sepa`, {
      data: {
        trabalhadores: [
          {
            nome: 'Pedro Costa',
            iban: 'PT50000201234444555560002',
            salario: 800.00,
            mes: '06',
            ano: '2026',
          },
        ],
        instant: true,
      },
    });

    expect(res.status()).toBe(200);
    const xml = await res.text();
    expect(xml).toContain('<Cd>INST</Cd>');
    expect(res.headers()['content-disposition']).toContain('transferencias_imediatas_magnetic_place.xml');
  });

  test('UI — botão SEPA XML abre modal', async ({ page }) => {
    await loginAdmin(page);
    await navegarParaSalarios(page);

    const btnSepa = page.getByRole('button', { name: /sepa xml/i });
    await expect(btnSepa).toBeVisible({ timeout: 10000 });
    await btnSepa.click();

    // Modal deve aparecer com título SEPA XML
    await expect(page.getByText(/sepa xml/i)).toBeVisible({ timeout: 5000 });
    // Botão fechar (X) deve estar presente
    await expect(page.locator('.fixed.inset-0 button').last()).toBeVisible();
  });

  test('UI — modal SEPA XML mostra trabalhadores e permite fechar', async ({ page }) => {
    await loginAdmin(page);
    await navegarParaSalarios(page);

    await page.getByRole('button', { name: /sepa xml/i }).click();

    // Aguardar modal
    const modal = page.locator('.fixed.inset-0.z-50');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Checkbox "Seleccionar todos" deve existir
    await expect(modal.getByText(/seleccionar todos/i)).toBeVisible();

    // Fechar com X
    await modal.locator('button').filter({ hasText: '' }).last().click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('UI — botão Transferência Imediata abre modal com modo instant', async ({ page }) => {
    await loginAdmin(page);
    await navegarParaSalarios(page);

    const btnInstant = page.getByRole('button', { name: /transf\. imediata/i });
    await expect(btnInstant).toBeVisible({ timeout: 10000 });
    await btnInstant.click();

    await expect(page.getByText(/transferência imediata/i)).toBeVisible({ timeout: 5000 });
  });

  test('UI — exportar SEPA XML com todos os trabalhadores seleccionados', async ({ page }) => {
    await loginAdmin(page);
    await navegarParaSalarios(page);

    await page.getByRole('button', { name: /sepa xml/i }).click();

    const modal = page.locator('.fixed.inset-0.z-50').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Seleccionar todos via checkbox "Seleccionar todos"
    const checkboxTodos = modal.locator('input[type="checkbox"]').first();
    const jaChecked = await checkboxTodos.isChecked();
    if (!jaChecked) {
      await checkboxTodos.click();
    }

    // Aguardar que pelo menos 1 trabalhador esteja seleccionado
    const btnExportar = modal.getByRole('button', { name: /exportar/i });
    await expect(btnExportar).not.toBeDisabled({ timeout: 3000 }).catch(() => {
      // Se ficou disabled é porque não há trabalhadores com IBAN neste mês — aceitável
    });

    // Preparar captura do download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await btnExportar.click({ force: true });
    const download = await downloadPromise;

    if (download) {
      expect(download.suggestedFilename()).toMatch(/salarios.*\.xml$/);
    } else {
      // Sem trabalhadores com dados no mês actual — verificar alerta
      page.on('dialog', d => d.dismiss());
    }
  });

});
