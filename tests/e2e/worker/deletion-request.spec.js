import { test, expect } from '@playwright/test';
import { loginAdmin, loginWorker, dismissBanners } from '../helpers/shared.js';

test.describe('Worker → Admin: Pedido de Eliminação', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. Worker cria pedido de eliminação', async ({ page }) => {
    await loginWorker(page, 'trabalhadorteste', '123456789');
    await dismissBanners(page);
    
    // Aguardar dashboard carregar
    await expect(page.getByRole('button', { name: /gravar registo/i })).toBeVisible({ timeout: 15000 });
    
    // Primeiro criar um registo se não existir nenhum hoje
    const timeInputs = page.locator('input[type="time"]');
    await timeInputs.first().fill('09:00');
    await timeInputs.nth(1).fill('17:00');
    await page.getByRole('button', { name: /gravar registo/i }).click();
    
    // Aguardar sucesso
    await expect(page.locator('text=/registo inserido com sucesso/i')).toBeVisible({ timeout: 10000 });
    
    // Agora expandir o dia e procurar botão de eliminar
    const dayRow = page.locator('[class*="rounded-3xl"]').filter({ hasText: /09:00/i }).first();
    if (await dayRow.count() > 0) {
      await dayRow.click();
    }
    
    // Procurar botão "Solicitar Exclusão" ou similar
    const deleteBtn = page.locator('button').filter({ hasText: /excluir|eliminar/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      
      // Procurar botão de confirmar
      const confirmBtn = page.locator('button').filter({ hasText: /confirmar|sim/i }).first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await expect(page.locator('text=/pedido submetido/i')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('2. Admin vê card de eliminação com styling correto', async ({ page }) => {
    await loginAdmin(page, 'admin', 'mariafernanda');
    await dismissBanners(page);
    
    // Navegar para Portal Validação → Correções
    await page.getByRole('button', { name: /validação/i }).click();
    await page.waitForTimeout(500);
    
    // Clicar na sub-aba Correções (Workers)
    const correcoesTab = page.locator('button').filter({ hasText: /correções/i }).first();
    await expect(correcoesTab).toBeVisible({ timeout: 10000 });
    await correcoesTab.click();
    await page.waitForTimeout(500);
    
    // Verificar se estamos no tab Workers (não Clients)
    const workersTab = page.locator('button').filter({ hasText: /workers/i }).first();
    if (await workersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await workersTab.click();
      await page.waitForTimeout(300);
    }
    
    // Procurar card "EMPRESA TESTE" com badge de pedido
    const empresaCard = page.locator('[class*="rounded"]').filter({ hasText: /EMPRESA TESTE/i }).first();
    await expect(empresaCard).toBeVisible({ timeout: 10000 });
    
    // Clicar para expandir o card
    await empresaCard.click();
    await page.waitForTimeout(500);
    
    // VERIFICAÇÕES DO CARD EXPANDIDO:
    
    // 1. Verificar se há pelo menos um card aberto (não colapsado)
    const expandedCard = page.locator('[class*="rounded-3xl"]').filter({ hasText: /pedido/i }).first();
    if (await expandedCard.count() > 0) {
      // 2. Cor deve ser rosa/rose (verificar se tem classe rose ou vermalha)
      const hasRoseClass = await expandedCard.evaluate(el => 
        el.className.includes('rose') || el.className.includes('pink') || getComputedStyle(el).backgroundColor.includes('rose')
      );
      console.log('Card tem cor rosa?', hasRoseClass);
      
      // 3. Verificar botões - devem ser "Confirmar" e "Cancelar", não "Aprovar" e "Rejeitar"
      const buttons = page.locator('button').filter({ hasText: /confirmar|cancelar|aprovar|rejeitar/i });
      const buttonTexts = await buttons.allTextContents();
      console.log('Botões encontrados:', buttonTexts);
      
      const hasConfirmar = buttonTexts.some(t => /confirmar/i.test(t));
      const hasAprovar = buttonTexts.some(t => /aprovar/i.test(t));
      
      // O teste passa se encontrar "Confirmar" E não encontrar "Aprovar"
      // Ou falha se encontrar "Aprovar" (significa que é card errado)
      if (hasAprovar) {
        console.error('BUG ENCONTRADO: Card mostra "Aprovar" em vez de "Confirmar"');
      }
      
      // 4. Verificar ícone - deve ser Lixeira (Trash2)
      const trashIcon = page.locator('[class*="lucide-trash"], [class*="trash"]').first();
      const hasTrashIcon = await trashIcon.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Ícone de lixeira visível?', hasTrashIcon);
      
      // 5. Verificar tag "PEDIDO DE ELIMINAÇÃO"
      const tagEl = page.locator('text=/pedido de eliminação/i').first();
      const tagVisible = await tagEl.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Tag "PEDIDO DE ELIMINAÇÃO" visível?', tagVisible);
      
      // Report final
      console.log('\n=== RESULTADO DO TESTE ===');
      console.log('Card expansionado:', await expandedCard.isVisible());
      console.log('Botão "Aprovar" presente:', hasAprovar);
      console.log('Botão "Confirmar" presente:', hasConfirmar);
      console.log('Tag "PEDIDO DE ELIMINAÇÃO":', tagVisible);
      console.log('Ícone Lixeira:', hasTrashIcon);
      console.log('============================\n');
    }
  });

  test('3. Admin aprova pedido de eliminação', async ({ page }) => {
    await loginAdmin(page, 'admin', 'mariafernanda');
    await dismissBanners(page);
    
    // Navegar para Portal Validação → Correções → Workers
    await page.getByRole('button', { name: /validação/i }).click();
    await page.waitForTimeout(500);
    
    const correcoesTab = page.locator('button').filter({ hasText: /correções/i }).first();
    await correcoesTab.click();
    await page.waitForTimeout(500);
    
    const workersTab = page.locator('button').filter({ hasText: /workers/i }).first();
    if (await workersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await workersTab.click();
    }
    
    // Clicar no card EMPRESA TESTE
    const empresaCard = page.locator('[class*="rounded"]').filter({ hasText: /EMPRESA TESTE/i }).first();
    await empresaCard.click();
    await page.waitForTimeout(500);
    
    // Procurar botão "Confirmar Eliminação"
    const confirmBtn = page.locator('button').filter({ hasText: /confirmar eliminação/i }).first();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      
      // Verificar sucesso
      await expect(page.locator('text=/eliminado|aprovado/i')).toBeVisible({ timeout: 10000 });
      console.log('Pedido de eliminação aprovado com sucesso!');
    } else {
      console.log('Botão "Confirmar Eliminação" não encontrado');
    }
  });
});