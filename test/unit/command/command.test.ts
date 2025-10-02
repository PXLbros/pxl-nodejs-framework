import { describe, it, expect, beforeEach, vi } from 'vitest';
import Command from '../../../src/command/command.js';
import type { CommandConstructorParams } from '../../../src/command/command.interface.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import type RedisInstance from '../../../src/redis/instance.js';
import type QueueManager from '../../../src/queue/manager.js';
import type DatabaseInstance from '../../../src/database/instance.js';
import { Logger } from '../../../src/logger/index.js';

// Mock Logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    custom: vi.fn(),
  },
}));

// Concrete implementation for testing
class TestCommand extends Command {
  public name = 'test-command';
  public description = 'A test command for unit testing';

  public async run(): Promise<void> {
    // Test implementation
  }
}

describe('Command', () => {
  let command: TestCommand;
  let mockParams: CommandConstructorParams;

  beforeEach(() => {
    vi.clearAllMocks();

    mockParams = {
      applicationConfig: {
        name: 'TestApp',
        instanceId: 'test-instance',
        rootDirectory: '/tmp',
      } as ApplicationConfig,
      redisInstance: {} as RedisInstance,
      queueManager: {} as QueueManager,
      databaseInstance: {} as DatabaseInstance,
    };

    command = new TestCommand(mockParams);
  });

  describe('Constructor', () => {
    it('should initialize with application config', () => {
      expect(command['applicationConfig']).toBe(mockParams.applicationConfig);
    });

    it('should initialize with redis instance', () => {
      expect(command['redisInstance']).toBe(mockParams.redisInstance);
    });

    it('should initialize with queue manager', () => {
      expect(command['queueManager']).toBe(mockParams.queueManager);
    });

    it('should initialize with database instance', () => {
      expect(command['databaseInstance']).toBe(mockParams.databaseInstance);
    });

    it('should initialize logger', () => {
      expect(command['logger']).toBe(Logger);
    });
  });

  describe('Abstract properties', () => {
    it('should have a name property', () => {
      expect(command.name).toBe('test-command');
    });

    it('should have a description property', () => {
      expect(command.description).toBe('A test command for unit testing');
    });
  });

  describe('Abstract methods', () => {
    it('should have a run method', () => {
      expect(typeof command.run).toBe('function');
    });

    it('should return a Promise from run method', async () => {
      const result = command.run();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('log method', () => {
    it('should log a message with command custom level', () => {
      command.log('Test message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'command',
        message: 'Test message',
        meta: {
          Command: 'test-command',
        },
      });
    });

    it('should log a message with additional meta', () => {
      command.log('Test message', { userId: '123', action: 'build' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'command',
        message: 'Test message',
        meta: {
          Command: 'test-command',
          userId: '123',
          action: 'build',
        },
      });
    });

    it('should include command name in meta', () => {
      command.log('Processing...');

      const call = (Logger.custom as any).mock.calls[0][0];
      expect(call.meta.Command).toBe('test-command');
    });

    it('should handle empty meta', () => {
      command.log('Simple log');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'command',
        message: 'Simple log',
        meta: {
          Command: 'test-command',
        },
      });
    });

    it('should merge additional meta with command name', () => {
      command.log('Building project', {
        target: 'production',
        version: '1.0.0',
      });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'command',
        message: 'Building project',
        meta: {
          Command: 'test-command',
          target: 'production',
          version: '1.0.0',
        },
      });
    });
  });

  describe('Dependency injection', () => {
    it('should provide access to application config', () => {
      expect(command['applicationConfig'].name).toBe('TestApp');
      expect(command['applicationConfig'].instanceId).toBe('test-instance');
    });

    it('should provide access to redis instance', () => {
      expect(command['redisInstance']).toBeDefined();
    });

    it('should provide access to queue manager', () => {
      expect(command['queueManager']).toBeDefined();
    });

    it('should provide access to database instance', () => {
      expect(command['databaseInstance']).toBeDefined();
    });

    it('should provide access to logger', () => {
      expect(command['logger']).toBeDefined();
      expect(command['logger']).toBe(Logger);
    });
  });

  describe('Custom command implementation', () => {
    class CustomCommand extends Command {
      public name = 'custom';
      public description = 'Custom command';
      public executed = false;

      public async run(): Promise<void> {
        this.executed = true;
        this.log('Command executed');
      }
    }

    it('should allow custom command implementations', async () => {
      const customCommand = new CustomCommand(mockParams);

      await customCommand.run();

      expect(customCommand.executed).toBe(true);
      expect(Logger.custom).toHaveBeenCalled();
    });

    it('should support different command names', () => {
      const customCommand = new CustomCommand(mockParams);
      expect(customCommand.name).toBe('custom');
    });

    it('should support different descriptions', () => {
      const customCommand = new CustomCommand(mockParams);
      expect(customCommand.description).toBe('Custom command');
    });
  });
});
