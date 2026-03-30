import { afterEach, beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';

// Store original console methods
const _originalConsole = { ...global.console };

// Clean up mocks before and after each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
