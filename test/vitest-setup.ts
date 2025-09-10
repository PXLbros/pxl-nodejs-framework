import { beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Mock console to avoid noise in tests (but allow debug if needed)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: originalConsole.warn, // Keep warnings visible
  error: originalConsole.error, // Keep errors visible
};

// Clean up mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
