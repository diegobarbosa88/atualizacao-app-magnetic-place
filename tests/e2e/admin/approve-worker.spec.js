import { test, expect } from '@playwright/test';
import { loginAdmin, dismissBanners } from '../helpers/shared.js';

test.describe('Admin — Aprovação de Horas de Trabalhador', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await loginAdmin(page);
    await dismissBanners(page);
    // Navegar para Portal Validação → Equipa
    await page.getByRole('button', { name: /validação/i }).click();
    await expect(page.getByRole('heading', { name: /portal de validação/i })).toBeVisible({ timeout: 10000 });
    await page.locator('main button').filter({ hasText: /^equipa$/i }).first().click();
  });

  test('1. Sub-aba Equipa carrega lista de colaboradores', async ({ page }) => {
    // Cabeçalho "Colaborador" visível na tabela
    await expect(page.locator('text=/colaborador/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('2. Botão Aprovar ou Anular está visível para pelo menos um trabalhador', async ({ page }) => {
    // Estado aprovado usa ícone — verificar pelos botões de ação
    await expect(
      page.getByRole('button', { name: /aprovar/i }).or(page.getByRole('button', { name: /anular/i })).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('3. Clicar Aprovar muda o estado para Aprovado', async ({ page }) => {
    const aprovarBtn = page.getByRole('button', { name: /^aprovar$/i }).first();
    const hasPending = await aprovarBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPending) {
      test.skip(true, 'Nenhum trabalhador pendente neste mês');
      return;
    }

    await aprovarBtn.click();
    // Após aprovação, o botão "Anular" aparece (estado aprovado usa ícone, não texto)
    await expect(page.getByRole('button', { name: /anular/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('4. Botão Anular reverte a aprovação', async ({ page }) => {
    const anularBtn = page.getByRole('button', { name: /^anular$/i }).first();
    const hasApproved = await anularBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasApproved) {
      test.skip(true, 'Nenhum trabalhador aprovado neste mês');
      return;
    }

    await anularBtn.click();
    // Após anular, botão Aprovar reaparece
    await expect(page.getByRole('button', { name: /^aprovar$/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
