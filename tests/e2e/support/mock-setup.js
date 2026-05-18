import { test, expect } from '@playwright/test';
import { worker } from '../../src/mocks/browser.js';

test.beforeEach(async () => {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
});

test.afterEach(async () => {
  await worker.stop();
});

export { expect };
export default { worker };