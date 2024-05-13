import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('src', import.meta.url).pathname,
    },
  },
  test: {
    include: ['__tests__/**/*.spec.js'],
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.js'],
    },
  },
});
