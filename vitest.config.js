import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.test.jsx', 'tests/integration/**/*.test.js', 'tests/integration/**/*.test.jsx', 'tests/performance/**/*.test.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
});
