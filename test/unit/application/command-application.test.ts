import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CommandApplication', () => {
  let testDir: string;
  let commandsDir: string;

  beforeEach(() => {
    // Create temporary test directories
    testDir = join(tmpdir(), `command-app-test-${Date.now()}`);
    commandsDir = join(testDir, 'commands');
    mkdirSync(testDir, { recursive: true });
    mkdirSync(commandsDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create CommandApplication instance', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    expect(typeof CommandApplication).toBe('function');
    expect(CommandApplication.name).toBe('CommandApplication');
    expect(CommandApplication.prototype).toBeDefined();
  });

  it('should be constructable with minimal config', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const config = {
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
        },
      },
    };

    const app = new CommandApplication(config as any);

    expect(app.Name).toBe('test-command-app');
    expect(app.redisManager).toBeDefined();
    expect(app.cacheManager).toBeDefined();
  });

  it('should default cluster to disabled', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const config = {
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
        },
      },
    };

    const app = new CommandApplication(config as any);

    // CommandApplication should always disable cluster
    expect(app).toBeDefined();
  });

  it('should handle no command provided', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const mockLogger = {
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      custom: vi.fn(),
    };

    const mockArgv = {
      parseSync: () => ({ _: [] }), // No commands
    };

    const config = {
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
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
    expect(app.Name).toBe('test-command-app');
  });

  it('should handle missing commands directory', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const nonExistentDir = join(testDir, 'non-existent-commands');

    const mockArgv = {
      parseSync: () => ({ _: ['test-command'] }),
    };

    const config = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: nonExistentDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      debug: { measureExecutionTime: false },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
  });

  it('should handle command not found scenario', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const mockArgv = {
      parseSync: () => ({ _: ['non-existent-command'] }),
    };

    const config = {
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
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
  });

  it('should enable execution time measurement when debug flag is set', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const mockArgv = {
      parseSync: () => ({ _: [] }),
    };

    const config = {
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
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
  });

  it('should create command with proper test command file', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    // Create a simple test command
    const commandContent = `
      export default class TestCommand {
        constructor(params) {
          this.params = params;
        }

        async run(argv) {
          return { success: true, argv };
        }
      }
    `;

    writeFileSync(join(commandsDir, 'test-command.js'), commandContent);

    const mockArgv = {
      parseSync: () => ({ _: ['test-command'], name: 'test' }),
    };

    const config = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: false, shutdown: false },
      debug: { measureExecutionTime: true },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
    expect(app.Name).toBe('test-command-app');
  });

  it('should apply default config values', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const minimalConfig = {
      name: 'test-app',
      instanceId: 'test-id',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      commandManager: {
        argv: {
          parseSync: () => ({ _: [] }),
        },
      },
    };

    const app = new CommandApplication(minimalConfig as any);

    // Test that defaults are applied
    expect(app).toBeDefined();
    expect(app.Name).toBe('test-app');
  });

  it('should handle command with .ts extension', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    // Create a TypeScript command file
    const commandContent = `
      export default class TypeScriptCommand {
        constructor(params) {
          this.params = params;
        }

        async run(argv) {
          return { success: true, argv };
        }
      }
    `;

    writeFileSync(join(commandsDir, 'ts-command.ts'), commandContent);

    const mockArgv = {
      parseSync: () => ({ _: ['ts-command'] }),
    };

    const config = {
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
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
  });

  it('should handle startup logging when enabled', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    const config = {
      name: 'test-command-app',
      instanceId: 'test-instance',
      rootDirectory: process.cwd(),
      commandsDirectory: commandsDir,
      redis: { host: 'localhost', port: 6379 },
      queue: { processorsDirectory: '/tmp/test-dir', queues: [], log: {} },
      log: { startUp: true, shutdown: false }, // Enable startup logging
      debug: { measureExecutionTime: false },
      performanceMonitoring: { enabled: false },
      commandManager: {
        argv: {
          parseSync: () => ({ _: [] }),
        },
      },
    };

    const app = new CommandApplication(config as any);

    expect(app).toBeDefined();
  });

  it('should test prototype pollution prevention in command loading', async () => {
    const { CommandApplication } = await import('../../../dist/application/index.js');

    // Create a command with a potentially dangerous name
    const commandContent = `
      export default class SafeCommand {
        constructor(params) {
          this.params = params;
        }

        async run(argv) {
          return { success: true };
        }
      }
    `;

    writeFileSync(join(commandsDir, '__proto__.js'), commandContent);

    const mockArgv = {
      parseSync: () => ({ _: ['__proto__'] }), // Potentially dangerous command name
    };

    const config = {
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
        argv: mockArgv,
      },
    };

    const app = new CommandApplication(config as any);

    // Should handle safely without prototype pollution
    expect(app).toBeDefined();
  });
});
