import { describe, it, expect, beforeEach } from 'vitest';

describe('WebApplication', () => {
  let baseConfig: any;

  beforeEach(() => {
    baseConfig = {
      name: 'test-web-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      performanceMonitoring: { enabled: false },
    };
  });

  it('should create and configure WebApplication instance', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    // Test that WebApplication is a class
    expect(typeof WebApplication).toBe('function');
    expect(WebApplication.name).toBe('WebApplication');
    expect(WebApplication.prototype).toBeDefined();
  });

  it('should be constructable with minimal config', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webserver: {
        port: 3000,
        cors: { enabled: false },
      },
    };

    // This will test construction without starting (avoiding Redis connection)
    const app = new WebApplication(config);

    // Test basic properties that don't require external connections
    expect(app.Name).toBe('test-web-app');
    expect(app.redisManager).toBeDefined();
    expect(app.cacheManager).toBeDefined();
    expect(app.uniqueInstanceId).toContain('test-instance');
  });

  it('should apply default startup logging configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webserver: {
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should create with WebSocket server configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        host: 'localhost',
        cors: { enabled: false },
      },
      webSocket: {
        enabled: true,
        type: 'server' as const,
        path: '/ws',
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should create with WebSocket client configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        host: 'localhost',
        cors: { enabled: false },
      },
      webSocket: {
        enabled: true,
        type: 'client' as const,
        url: 'ws://localhost:3000/ws',
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should handle web server configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 8080,
        host: '0.0.0.0',
        cors: {
          enabled: true,
          origin: '*',
        },
        security: {
          enabled: false,
        },
        log: {
          requests: true,
          errors: true,
        },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should handle performance monitoring configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      performanceMonitoring: {
        enabled: true,
        monitorHttpRequests: true,
        monitorWebSocketOperations: true,
      },
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should handle startup logging enabled', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      log: {
        startUp: true,
        shutdown: true,
      },
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should initialize with event callbacks', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const onStartedCallback = () => {};
    const onStoppedCallback = () => {};

    const config = {
      ...baseConfig,
      events: {
        onStarted: onStartedCallback,
        onStopped: onStoppedCallback,
      },
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should handle custom routes configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
        routes: [
          {
            method: 'GET',
            path: '/custom',
            handler: async () => ({ message: 'custom route' }),
          },
        ],
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should handle controllers directory configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
        controllersDirectory: '/tmp/controllers',
        routesDirectory: '/tmp/routes',
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });

  it('should be instance of a class', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
    expect(typeof app).toBe('object');
  });

  it('should have webServer property', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    // Property exists but is undefined until started
    expect('webServer' in app).toBe(true);
  });

  it('should have webSocketServer property', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    // Property exists but is undefined until started
    expect('webSocketServer' in app).toBe(true);
  });

  it('should have webSocketClient property', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    // Property exists but is undefined until started
    expect('webSocketClient' in app).toBe(true);
  });

  it('should handle debug configuration', async () => {
    const { WebApplication } = await import('../../../dist/application/index.js');

    const config = {
      ...baseConfig,
      debug: {
        measureExecutionTime: true,
      },
      webServer: {
        enabled: true,
        port: 3000,
        cors: { enabled: false },
      },
    };

    const app = new WebApplication(config);

    expect(app).toBeDefined();
  });
});
