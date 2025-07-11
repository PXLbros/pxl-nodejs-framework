import { mock } from 'node:test';

/**
 * Creates a mock function that resolves to the provided value
 */
export function createMockResolves<T>(value: T) {
  return mock.fn(() => Promise.resolve(value));
}

/**
 * Creates a mock function that rejects with the provided error
 */
export function createMockRejects(error: Error) {
  return mock.fn(() => Promise.reject(error));
}

/**
 * Creates a mock function that returns the provided value
 */
export function createMockReturns<T>(value: T) {
  return mock.fn(() => value);
}

/**
 * Wait for a specified amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock configuration object for testing
 */
export function createMockConfig(overrides: Record<string, any> = {}) {
  return {
    database: {
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      password: 'test_pass',
      ...overrides.database,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      ...overrides.redis,
    },
    queue: {
      enabled: false,
      ...overrides.queue,
    },
    cluster: {
      enabled: false,
      ...overrides.cluster,
    },
    webServer: {
      enabled: false,
      port: 3000,
      ...overrides.webServer,
    },
    ...overrides,
  };
}
