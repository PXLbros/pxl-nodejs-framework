import { beforeEach, afterEach, mock } from 'node:test';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  mock.restoreAll();
});

afterEach(() => {
  // Clean up after each test
  mock.restoreAll();
});

// Mock console to avoid noise in tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: mock.fn(),
  debug: mock.fn(),
  info: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
