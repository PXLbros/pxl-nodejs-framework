import type { WebApplicationConfig } from '../../../dist/application/web-application.interface.js';

/**
 * Creates a minimal test configuration for WebApplication
 */
export function createTestWebApplicationConfig(overrides: Partial<WebApplicationConfig> = {}): WebApplicationConfig {
  const testPort = Math.floor(Math.random() * 10000) + 30000; // Random port between 30000-40000

  const baseConfig: WebApplicationConfig = {
    name: 'test-web-app',
    instanceId: 'test-instance',
    rootDirectory: process.cwd(),

    // Redis configuration (mocked)
    redis: {
      host: 'localhost',
      port: 6379,
    },

    // Queue configuration (minimal)
    queue: {
      processorsDirectory: '/tmp/test-processors',
      queues: [],
      log: {},
    },

    // Logging configuration
    log: {
      startUp: false,
      shutdown: false,
    },

    // Performance monitoring
    performanceMonitoring: {
      enabled: false,
    },

    // Web server configuration
    webServer: {
      enabled: true,
      port: testPort,
      host: '127.0.0.1',
      cors: {
        enabled: false,
      },
      log: {
        startUp: false,
      },
      debug: {
        printRoutes: false,
      },
    },
  };

  return { ...baseConfig, ...overrides };
}

/**
 * Makes an HTTP request to test server availability
 */
export async function testServerRequest(port: number, path: string = '/'): Promise<{ status: number; ok: boolean }> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    throw new Error(`Failed to connect to server on port ${port}: ${error}`);
  }
}

/**
 * Waits for server to be ready by polling
 */
export async function waitForServer(port: number, timeoutMs: number = 5000, intervalMs: number = 100): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      await testServerRequest(port);
      return; // Server is ready
    } catch (error) {
      // Server not ready yet, wait and try again
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(`Server on port ${port} did not become ready within ${timeoutMs}ms`);
}

/**
 * Gets a free port for testing
 */
export function getTestPort(): number {
  return Math.floor(Math.random() * 10000) + 30000;
}
