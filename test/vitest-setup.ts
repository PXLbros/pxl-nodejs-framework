import { beforeEach, vi, afterEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Store original console methods
const originalConsole = { ...global.console };

// Clean up mocks before and after each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
