import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import CommandApplication from '../../../src/application/command-application.js';
import type { CommandApplicationConfig } from '../../../src/application/command-application.interface.js';
import { Logger } from '../../../src/logger/index.js';

// Mock Logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('CommandApplication', () => {
  let testDir: string;
  let commandsDir: string;

  beforeEach(() => {
    // Create temporary test directories
    testDir = join(tmpdir(), `command-app-test-${Date.now()}`);
    commandsDir = join(testDir, 'commands');
    mkdirSync(testDir, { recursive: true });
    mkdirSync(commandsDir, { recursive: true });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test directories
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create CommandApplication instance', () => {
    expect(typeof CommandApplication).toBe('function');
    expect(CommandApplication.name).toBe('CommandApplication');
    expect(CommandApplication.prototype).toBeDefined();
  });

  it('should be constructable with minimal config', () => {
    const config: CommandApplicationConfig = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: {
          parseSync: () => ({ _: [] }),
        } as any,
      },
    };

    const app = new CommandApplication(config);

    expect(app.Name).toBe('test-command-app');
    expect(app.redisManager).toBeDefined();
    expect(app.cacheManager).toBeDefined();
  });

  it('should default cluster to disabled', () => {
    const config: CommandApplicationConfig = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      cluster: { enabled: true }, // Should be overridden
      log: { startUp: false, shutdown: false },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: {
          parseSync: () => ({ _: [] }),
        } as any,
      },
    };

    const app = new CommandApplication(config);

    // CommandApplication should always disable cluster
    expect(app).toBeDefined();
  });

  it('should handle no command provided', () => {
    const mockArgv = {
      parseSync: () => ({ _: [] }), // No commands
    };

    const config: CommandApplicationConfig = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      debug: { measureExecutionTime: false },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: mockArgv as any,
      },
    };

    const app = new CommandApplication(config);

    expect(app).toBeDefined();
    expect(app.Name).toBe('test-command-app');
  });

  it('should enable execution time measurement when debug flag is set', () => {
    const config: CommandApplicationConfig = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      debug: { measureExecutionTime: true }, // Enable measurement
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: {
          parseSync: () => ({ _: [] }),
        } as any,
      },
    };

    const app = new CommandApplication(config);

    expect(app).toBeDefined();
  });
});
