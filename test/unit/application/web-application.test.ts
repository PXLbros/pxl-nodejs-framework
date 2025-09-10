import { describe, it, expect } from 'vitest';

describe('WebApplication', () => {
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
      name: 'test-web-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      performanceMonitoring: { enabled: false },
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
});
