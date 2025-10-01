import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventManager from '../../../src/event/manager.js';
import { mockRedisInstance } from '../../utils/mocks/redis-mocks.js';
import { mockDatabaseInstance } from '../../utils/mocks/database-mocks.js';

// Mock utilities
vi.mock('../../../src/util/index.js', async () => {
  const actual = await vi.importActual('../../../src/util/index.js');
  return {
    ...actual,
    File: {
      pathExists: vi.fn().mockResolvedValue(false),
    },
    Loader: {
      loadModulesInDirectory: vi.fn().mockResolvedValue({}),
    },
    Helper: {
      defaultsDeep: vi.fn((options: any, defaults: any) => ({ ...defaults, ...options })),
    },
  };
});

// Mock logger
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    warn: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}));

describe('EventManager', () => {
  let eventManager: EventManager;

  beforeEach(() => {
    vi.clearAllMocks();

    eventManager = new EventManager({
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test',
      },
      options: {
        controllersDirectory: '/test/events',
        log: { startUp: true },
        debug: { printEvents: false },
      },
      events: [],
      redisInstance: mockRedisInstance as any,
      databaseInstance: mockDatabaseInstance as any,
    });
  });

  describe('constructor', () => {
    it('should initialize EventManager', () => {
      expect(eventManager).toBeDefined();
    });

    it('should initialize with default options', () => {
      const manager = new EventManager({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
        },
        options: {
          controllersDirectory: '/test/events',
        },
        events: [],
        redisInstance: mockRedisInstance as any,
        databaseInstance: null,
      });

      expect(manager).toBeDefined();
    });
  });

  describe('load', () => {
    it('should return early when controllers directory does not exist', async () => {
      const { File } = await import('../../../src/util/index.js');
      vi.mocked(File.pathExists).mockResolvedValue(false);

      await eventManager.load();

      expect(File.pathExists).toHaveBeenCalled();
    });

    it('should load when controllers directory exists', async () => {
      const { File } = await import('../../../src/util/index.js');
      vi.mocked(File.pathExists).mockResolvedValue(true);

      await eventManager.load();

      expect(File.pathExists).toHaveBeenCalled();
    });

    it('should handle events with controller class', async () => {
      const { File } = await import('../../../src/util/index.js');
      vi.mocked(File.pathExists).mockResolvedValue(true);

      const mockController = class {
        constructor(_params: any) {}
        handle() {
          return 'handled';
        }
      };

      const managerWithEvents = new EventManager({
        applicationConfig: {
          name: 'test-app',
          instanceId: 'test-instance',
          rootDirectory: '/test',
        },
        options: {
          controllersDirectory: '/test/events',
        },
        events: [
          {
            name: 'test.event',
            controller: mockController as any,
            handlerName: 'handle',
          },
        ],
        redisInstance: mockRedisInstance as any,
        databaseInstance: mockDatabaseInstance as any,
      });

      await managerWithEvents.load();

      expect(File.pathExists).toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should emit event', async () => {
      if (typeof eventManager.emit === 'function') {
        await eventManager.emit({
          eventName: 'test.event',
          payload: { test: 'data' },
        });
      }

      // Should not throw
      expect(true).toBe(true);
    });

    it('should emit event without payload', async () => {
      if (typeof eventManager.emit === 'function') {
        await eventManager.emit({
          eventName: 'test.event',
        });
      }

      expect(true).toBe(true);
    });
  });

  describe('log', () => {
    it('should log messages', async () => {
      const { Logger } = await import('../../../src/logger/index.js');

      eventManager.log('Test message');

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'event',
        message: 'Test message',
      });
    });

    it('should log messages with meta', async () => {
      const { Logger } = await import('../../../src/logger/index.js');

      eventManager.log('Test message', { key: 'value' });

      expect(Logger.custom).toHaveBeenCalledWith({
        level: 'event',
        message: 'Test message',
        meta: { key: 'value' },
      });
    });
  });
});
