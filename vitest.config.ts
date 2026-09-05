import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/bench/**'],
    testTimeout: 60_000,
  },
});
