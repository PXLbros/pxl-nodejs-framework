import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MikroORM } from '@mikro-orm/postgresql';
import DatabaseManager from '../../../src/database/manager.js';
import DatabaseInstance from '../../../src/database/instance.js';
import { Logger } from '../../../src/logger/index.js';
import type { ApplicationDatabaseOptions } from '../../../src/database/manager.interface.js';

// Mock dependencies
vi.mock('@mikro-orm/postgresql');
vi.mock('../../../src/database/instance.js', () => ({
  default: vi.fn(),
}));
vi.mock('../../../src/logger/index.js');
vi.mock('../../../src/performance/index.js', () => ({
  DatabasePerformanceWrapper: {
    monitorConnection: vi.fn((_operation, callback) => callback()),
  },
}));

const mockMikroORM = vi.mocked(MikroORM);
const MockDatabaseInstance = vi.mocked(DatabaseInstance);
const mockLogger = vi.mocked(Logger);

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager;
  let mockOptions: ApplicationDatabaseOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DatabaseInstance mock as a proper constructor
    MockDatabaseInstance.mockImplementation(function (this: any, opts: any) {
      this.disconnect = vi.fn().mockResolvedValue(undefined);
      return this;
    } as any);

    mockOptions = {
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test/root',
        redis: {
          host: 'localhost',
          port: 6379,
          password: '',
        },
        queue: {
          queues: [],
          processorsDirectory: '/test/processors',
        },
      },
      host: 'localhost',
      port: 5432,
      username: 'testuser',
      password: 'testpass',
      databaseName: 'testdb',
      entitiesDirectory: '/test/entities',
    };

    databaseManager = new DatabaseManager(mockOptions);
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(databaseManager).toBeInstanceOf(DatabaseManager);
    });
  });

  describe('connect', () => {
    it('should connect to database and return DatabaseInstance', async () => {
      const mockOrm = {
        em: {
          fork: vi.fn(),
        },
        close: vi.fn(),
      };
      const mockInstance = {
        disconnect: vi.fn(),
      };

      mockMikroORM.init.mockResolvedValue(mockOrm as any);
      MockDatabaseInstance.mockImplementation(function (this: any) {
        return Object.assign(this, mockInstance);
      } as any);

      const result = await databaseManager.connect();

      expect(mockMikroORM.init).toHaveBeenCalled();
      expect(MockDatabaseInstance).toHaveBeenCalledWith({
        databaseManager,
        applicationConfig: mockOptions.applicationConfig,
        orm: mockOrm,
      });
      expect(result).toMatchObject(mockInstance);
    });

    it('should track multiple instances', async () => {
      const mockOrm1 = { em: { fork: vi.fn() }, close: vi.fn() };
      const mockOrm2 = { em: { fork: vi.fn() }, close: vi.fn() };
      const mockInstance1 = { disconnect: vi.fn().mockResolvedValue(undefined) };
      const mockInstance2 = { disconnect: vi.fn().mockResolvedValue(undefined) };

      mockMikroORM.init.mockResolvedValueOnce(mockOrm1 as any).mockResolvedValueOnce(mockOrm2 as any);

      MockDatabaseInstance.mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance1);
      } as any).mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance2);
      } as any);

      const instance1 = await databaseManager.connect();
      const instance2 = await databaseManager.connect();

      expect(instance1).toMatchObject(mockInstance1);
      expect(instance2).toMatchObject(mockInstance2);

      // Verify both instances are tracked
      await databaseManager.disconnect();
      expect(mockInstance1.disconnect).toHaveBeenCalled();
      expect(mockInstance2.disconnect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockMikroORM.init.mockRejectedValue(connectionError);

      await expect(databaseManager.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect all instances', async () => {
      const mockOrm = { em: { fork: vi.fn() }, close: vi.fn() };
      const mockInstance1 = { disconnect: vi.fn().mockResolvedValue(undefined) };
      const mockInstance2 = { disconnect: vi.fn().mockResolvedValue(undefined) };

      mockMikroORM.init.mockResolvedValue(mockOrm as any);
      MockDatabaseInstance.mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance1);
      } as any).mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance2);
      } as any);

      // Create two connections
      await databaseManager.connect();
      await databaseManager.connect();

      // Disconnect all
      await databaseManager.disconnect();

      expect(mockInstance1.disconnect).toHaveBeenCalled();
      expect(mockInstance2.disconnect).toHaveBeenCalled();
    });

    it('should clear instances array after disconnect', async () => {
      const mockOrm = { em: { fork: vi.fn() }, close: vi.fn() };
      const mockInstance = { disconnect: vi.fn().mockResolvedValue(undefined) };

      mockMikroORM.init.mockResolvedValue(mockOrm as any);
      MockDatabaseInstance.mockImplementation(function (this: any) {
        return Object.assign(this, mockInstance);
      } as any);

      await databaseManager.connect();
      await databaseManager.disconnect();

      // Verify no instances are disconnected on second call
      vi.clearAllMocks();
      await databaseManager.disconnect();
      expect(mockInstance.disconnect).not.toHaveBeenCalled();
    });

    it('should handle disconnection errors gracefully', async () => {
      const mockOrm = { em: { fork: vi.fn() }, close: vi.fn() };
      const mockInstance1 = { disconnect: vi.fn().mockRejectedValue(new Error('Disconnect error 1')) };
      const mockInstance2 = { disconnect: vi.fn().mockResolvedValue(undefined) };

      mockMikroORM.init.mockResolvedValue(mockOrm as any);
      MockDatabaseInstance.mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance1);
      } as any).mockImplementationOnce(function (this: any) {
        return Object.assign(this, mockInstance2);
      } as any);

      await databaseManager.connect();
      await databaseManager.connect();

      // Should not throw even if one instance fails to disconnect
      await expect(databaseManager.disconnect()).rejects.toThrow('Disconnect error 1');

      // But should still attempt to disconnect all instances
      expect(mockInstance1.disconnect).toHaveBeenCalled();
      expect(mockInstance2.disconnect).toHaveBeenCalled();
    });
  });

  describe('log', () => {
    it('should log with custom level', () => {
      const message = 'Test database message';
      const meta = { query: 'SELECT * FROM users' };

      databaseManager.log(message, meta);

      expect(mockLogger.custom).toHaveBeenCalledWith({
        level: 'database',
        message,
        meta,
      });
    });

    it('should log without meta', () => {
      const message = 'Simple database message';

      databaseManager.log(message);

      expect(mockLogger.custom).toHaveBeenCalledWith({
        level: 'database',
        message,
        meta: undefined,
      });
    });
  });
});
