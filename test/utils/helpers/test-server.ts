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
export async function testServerRequest(
  port: number,
  path: string = '/',
  options?: {
    method?: string;
    data?: any;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; ok: boolean; data?: any; headers?: any }> {
  try {
    const url = `http://127.0.0.1:${port}${path}`;
    const fetchOptions: RequestInit = {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    };

    if (options?.data && (options?.method === 'POST' || options?.method === 'PUT' || options?.method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(options.data);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        // Not valid JSON
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: Object.fromEntries(response.headers.entries()),
    };
  } catch (error) {
    throw new Error(`Failed to connect to server on port ${port}: ${error}`);
  }
}

/**
 * Detects if running in CI environment
 */
function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.TRAVIS ||
    process.env.JENKINS_URL ||
    process.env.BUILD_ID
  );
}

/**
 * Gets appropriate timeout based on environment
 */
function getDefaultTimeout(): number {
  // CI environments get longer timeout (60s) due to slower hardware
  // Local development gets 30s timeout
  return isCI() ? 60000 : 30000;
}

/**
 * Waits for server to be ready by polling with enhanced diagnostics
 */
export async function waitForServer(port: number, timeoutMs?: number, intervalMs: number = 100): Promise<void> {
  // Use provided timeout or detect appropriate default
  const finalTimeoutMs = timeoutMs ?? getDefaultTimeout();
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attemptCount = 0;

  if (process.env.DEBUG_TESTS) {
    console.log(
      `[waitForServer] Starting wait for server on port ${port}, timeout: ${finalTimeoutMs}ms, interval: ${intervalMs}ms`,
    );
  }

  while (Date.now() - startTime < finalTimeoutMs) {
    try {
      attemptCount++;
      await testServerRequest(port);
      if (process.env.DEBUG_TESTS) {
        console.log(
          `[waitForServer] Server ready on port ${port} (attempt ${attemptCount}, elapsed: ${Date.now() - startTime}ms)`,
        );
      }
      return; // Server is ready
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Server not ready yet, wait and try again
      if (process.env.DEBUG_TESTS && attemptCount % 10 === 0) {
        const elapsed = Date.now() - startTime;
        console.log(
          `[waitForServer] Still waiting for server on port ${port}... (${elapsed}ms / ${finalTimeoutMs}ms, attempt ${attemptCount})`,
        );
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  const elapsed = Date.now() - startTime;
  const errorMessage = lastError?.message || 'Unknown error';
  throw new Error(
    `Server on port ${port} did not become ready within ${finalTimeoutMs}ms (${elapsed}ms elapsed, ${attemptCount} attempts). Last error: ${errorMessage}`,
  );
}

/**
 * Gets a free port for testing
 */
export function getTestPort(): number {
  return Math.floor(Math.random() * 10000) + 30000;
}
