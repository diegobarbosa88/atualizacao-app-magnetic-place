import '@testing-library/jest-dom';
import { server } from '../src/mocks/server.js';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};

global.window = {
  ...global.window,
  supabase: null,
  schedules_global: [],
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());