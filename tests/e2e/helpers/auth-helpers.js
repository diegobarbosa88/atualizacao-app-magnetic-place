import { createSupabaseMock, resetMockSupabase } from './supabase-mock.js';

export const performLogin = async (page, userType = 'admin', mockData = {}) => {
  const mockSupabase = resetMockSupabase();

  if (mockData.workers) mockSupabase.data.workers = mockData.workers;
  if (mockData.clients) mockSupabase.data.clients = mockData.clients;
  if (mockData.app_notifications) mockSupabase.data.app_notifications = mockData.app_notifications;

  await page.addInitScript(() => {
    window.supabase = window.__mockSupabase;
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (userType === 'admin') {
    await page.locator('input').first().fill('admin');
    await page.locator('input[type="password"]').fill('admin123');
  } else if (userType === 'worker' && mockData.worker) {
    const loginName = mockData.worker.name.toLowerCase().replace(/\s+/g, '');
    await page.locator('input').first().fill(loginName);
    await page.locator('input[type="password"]').fill(mockData.worker.nif);
  }

  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  return mockSupabase;
};

export const loginAsAdmin = async (page, password = 'admin123') => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input[type="password"]');

  await usernameInput.fill('admin');
  await passwordInput.fill(password);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
};

export const loginAsWorker = async (page, workerName, nif) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const loginName = workerName.toLowerCase().replace(/\s+/g, '');
  const usernameInput = page.locator('input').first();
  const passwordInput = page.locator('input[type="password"]');

  await usernameInput.fill(loginName);
  await passwordInput.fill(nif);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
};

export const logout = async (page) => {
  const logoutButton = page.locator('button:has-text("Sair")').or(page.locator('button:has-text("Logout")').or(page.locator('button:has-text("Logout")')));
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
  }
  await page.waitForLoadState('networkidle');
};

export const navigateToTab = async (page, tabName) => {
  const tab = page.locator(`button:has-text("${tabName}")`).or(page.locator(`[role="tab"]:has-text("${tabName}")`));
  if (await tab.isVisible()) {
    await tab.click();
    await page.waitForTimeout(300);
  }
};

export const selectClientFromDropdown = async (page, clientName) => {
  const dropdown = page.locator('select').first();
  if (await dropdown.isVisible()) {
    await dropdown.selectOption({ label: clientName });
    await page.waitForTimeout(500);
  }
};
