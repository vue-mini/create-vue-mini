import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@': new URL('src', import.meta.url).pathname,
    },
  },
  test: {
    include: ['__tests__/**/*.spec.ts'],
    sequence: {
      hooks: 'list',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
    },
  },
});
