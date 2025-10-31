import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts}'],
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.interface.ts', // Exclude interface files from coverage
        '**/*.config.{js,ts}',
        'test/**',
      ],
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./test/vitest-setup.ts'],
    include: ['test/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules/**', 'dist/**'],
    pool: 'forks', // Better isolation for tests
    maxWorkers: 1, // Avoid issues with shared state (replaces singleFork in v4)
    isolate: false, // Avoid issues with shared state (replaces singleFork in v4)
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
