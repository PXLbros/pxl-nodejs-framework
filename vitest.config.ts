import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: ['node_modules/**', 'dist/**', 'coverage/**', '**/*.d.ts', '**/*.config.{js,ts}', 'test/**'],
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./test/vitest-setup.ts'],
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**'],
    pool: 'forks', // Better isolation for tests
    poolOptions: {
      forks: {
        singleFork: true, // Avoid issues with shared state
      },
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  esbuild: {
    target: 'node22',
  },
});
