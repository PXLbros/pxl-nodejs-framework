import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { testServerRequest, waitForServer, getTestPort } from '../../utils/helpers/test-server.js';
import { mockRedisInstance } from '../../utils/mocks/redis-mocks.js';
import { mockDatabaseManager } from '../../utils/mocks/database-mocks.js';
import { mockQueueManager } from '../../utils/mocks/queue-mocks.js';

describe('WebServer Startup Integration', () => {
  let WebServer: any;
  let webServer: any;
  let testPort: number;

  beforeAll(async () => {
    // Import WebServer
    const webServerModule = await import('../../../dist/webserver/webserver.js');
    WebServer = webServerModule.default;
  }, 15000);

  afterAll(async () => {
    if (webServer) {
      await webServer.stop();
    }
  });

  it('should start web server and respond to requests', async () => {
    testPort = getTestPort();

    // Create minimal application config for WebServer
    const applicationConfig = {
      name: 'test-web-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
    };

    // Create WebServer with minimal configuration
    webServer = new WebServer({
      applicationConfig,
      options: {
        host: '127.0.0.1',
        port: testPort,
        cors: { enabled: false },
        log: { startUp: false },
        debug: { printRoutes: false },
      },
      routes: [],
      redisInstance: mockRedisInstance,
      databaseInstance: mockDatabaseManager.getInstance(),
      queueManager: mockQueueManager,
      eventManager: {} as any, // Mock event manager
    });

    // Load and start the web server
    await webServer.load();
    await webServer.start();

    // Wait for server to be ready
    await waitForServer(testPort, 10000);

    // Test that server is responding
    const response = await testServerRequest(testPort, '/');

    // Server should respond (even if with 404, it means it's running)
    expect([200, 404]).toContain(response.status);

    // Verify server properties
    expect(webServer.fastifyServer).toBeDefined();
    expect(typeof webServer.fastifyServer.listen).toBe('function');
  }, 20000);

  it('should properly stop the web server', async () => {
    if (!webServer) {
      // Create server if not already created in previous test
      testPort = getTestPort();

      const applicationConfig = {
        name: 'test-web-app',
        instanceId: 'test-instance',
        rootDirectory: process.cwd(),
      };

      webServer = new WebServer({
        applicationConfig,
        options: {
          host: '127.0.0.1',
          port: testPort,
          cors: { enabled: false },
          log: { startUp: false },
        },
        routes: [],
        redisInstance: mockRedisInstance,
        databaseInstance: mockDatabaseManager.getInstance(),
        queueManager: mockQueueManager,
        eventManager: {} as any,
      });

      await webServer.load();
      await webServer.start();
      await waitForServer(testPort, 10000);
    }

    // Stop the server
    await webServer.stop();

    // Verify server is no longer accessible
    await expect(testServerRequest(testPort)).rejects.toThrow();
  }, 15000);

  it('should handle multiple start/stop cycles', async () => {
    const port = getTestPort();

    const applicationConfig = {
      name: 'test-web-app-cycles',
      instanceId: 'test-instance-cycles',
      rootDirectory: process.cwd(),
    };

    const testWebServer = new WebServer({
      applicationConfig,
      options: {
        host: '127.0.0.1',
        port: port,
        cors: { enabled: false },
        log: { startUp: false },
      },
      routes: [],
      redisInstance: mockRedisInstance,
      databaseInstance: mockDatabaseManager.getInstance(),
      queueManager: mockQueueManager,
      eventManager: {} as any,
    });

    // First cycle
    await testWebServer.load();
    await testWebServer.start();
    await waitForServer(port, 10000);

    let response = await testServerRequest(port);
    expect([200, 404]).toContain(response.status);

    await testWebServer.stop();

    // Verify stopped
    await expect(testServerRequest(port)).rejects.toThrow();

    // Second cycle - need to create new server instance
    const testWebServer2 = new WebServer({
      applicationConfig,
      options: {
        host: '127.0.0.1',
        port: port,
        cors: { enabled: false },
        log: { startUp: false },
      },
      routes: [],
      redisInstance: mockRedisInstance,
      databaseInstance: mockDatabaseManager.getInstance(),
      queueManager: mockQueueManager,
      eventManager: {} as any,
    });

    await testWebServer2.load();
    await testWebServer2.start();
    await waitForServer(port, 10000);

    response = await testServerRequest(port);
    expect([200, 404]).toContain(response.status);

    await testWebServer2.stop();
  }, 30000);
});
