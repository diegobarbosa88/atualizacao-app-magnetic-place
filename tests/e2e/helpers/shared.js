import { expect } from '@playwright/test';

export const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'admin';
export const WORKER_USERNAME = process.env.PLAYWRIGHT_WORKER_USERNAME || '';
export const WORKER_PASSWORD = process.env.PLAYWRIGHT_WORKER_PASSWORD || '';
export const CLIENT_ID = process.env.PLAYWRIGHT_CLIENT_ID || 'client_1778922721540';
export const CLIENT_MONTH = process.env.PLAYWRIGHT_CLIENT_MONTH || '2026-05';

export async function loginAdmin(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('button', { name: /geral/i })).toBeVisible({ timeout: 15000 });
}

export async function loginWorker(page, username = WORKER_USERNAME, password = WORKER_PASSWORD) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('input').first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}

export async function dismissBanners(page) {
  const container = page.locator('[class*="z-\\[9999\\]"]');
  if (await container.count() === 0) return;
  const closeButtons = container.locator('button');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    await closeButtons.first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
}
