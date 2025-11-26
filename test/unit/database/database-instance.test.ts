import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatabaseInstance from '../../../src/database/instance.js';
import type DatabaseManager from '../../../src/database/manager.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';
import type { MikroORM, EntityManager } from '@mikro-orm/postgresql';

describe('DatabaseInstance', () => {
  let databaseInstance: DatabaseInstance;
  let mockOrm: MikroORM;
  let mockEntityManager: EntityManager;
  let mockDatabaseManager: DatabaseManager;
  let mockApplicationConfig: ApplicationConfig;

  beforeEach(() => {
    // Create mock entity manager
    mockEntityManager = {
      fork: vi.fn().mockReturnThis(),
      clear: vi.fn(),
      transactional: vi.fn().mockImplementation(async callback => {
        return await callback(mockEntityManager);
      }),
    } as unknown as EntityManager;

    // Create mock ORM
    mockOrm = {
      isConnected: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      em: mockEntityManager,
    } as unknown as MikroORM;

    // Create mock database manager
    mockDatabaseManager = {
      log: vi.fn(),
    } as unknown as DatabaseManager;

    // Create mock application config
    mockApplicationConfig = {
      name: 'test-app',
    } as ApplicationConfig;

    // Create database instance
    databaseInstance = new DatabaseInstance({
      databaseManager: mockDatabaseManager,
      applicationConfig: mockApplicationConfig,
      orm: mockOrm,
    });
  });

  describe('isConnected', () => {
    it('should check if database is connected', async () => {
      const isConnected = await databaseInstance.isConnected();

      expect(isConnected).toBe(true);
      expect(mockOrm.isConnected).toHaveBeenCalledTimes(1);
    });

    it('should return false when database is not connected', async () => {
      mockOrm.isConnected = vi.fn().mockResolvedValue(false);

      const isConnected = await databaseInstance.isConnected();

      expect(isConnected).toBe(false);
    });
  });

  describe('getEntityManager', () => {
    it('should return a forked entity manager', () => {
      const em = databaseInstance.getEntityManager();

      expect(em).toBe(mockEntityManager);
      expect(mockEntityManager.fork).toHaveBeenCalledTimes(1);
    });

    it('should return a new forked entity manager on each call', () => {
      databaseInstance.getEntityManager();
      databaseInstance.getEntityManager();

      expect(mockEntityManager.fork).toHaveBeenCalledTimes(2);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database', async () => {
      await databaseInstance.disconnect();

      expect(mockOrm.close).toHaveBeenCalledTimes(1);
      expect(mockDatabaseManager.log).toHaveBeenCalledWith('Disconnected');
    });

    it('should log disconnection message', async () => {
      await databaseInstance.disconnect();

      expect(mockDatabaseManager.log).toHaveBeenCalledWith('Disconnected');
    });

    it('should handle disconnect errors gracefully', async () => {
      const error = new Error('Disconnect failed');
      mockOrm.close = vi.fn().mockRejectedValue(error);

      await expect(databaseInstance.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('withEntityManager', () => {
    it('should execute callback with forked entity manager', async () => {
      const callback = vi.fn().mockResolvedValue('test result');

      const result = await databaseInstance.withEntityManager(callback);

      expect(result).toBe('test result');
      expect(mockEntityManager.fork).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(mockEntityManager);
    });

    it('should clear entity manager after callback executes', async () => {
      const callback = vi.fn().mockResolvedValue('success');

      await databaseInstance.withEntityManager(callback);

      expect(mockEntityManager.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear entity manager even if callback throws error', async () => {
      const error = new Error('Callback failed');
      const callback = vi.fn().mockRejectedValue(error);

      await expect(databaseInstance.withEntityManager(callback)).rejects.toThrow('Callback failed');

      expect(mockEntityManager.clear).toHaveBeenCalledTimes(1);
    });

    it('should propagate callback return value', async () => {
      const expectedData = { id: 1, name: 'Test User' };
      const callback = vi.fn().mockResolvedValue(expectedData);

      const result = await databaseInstance.withEntityManager(callback);

      expect(result).toEqual(expectedData);
    });

    it('should fork new entity manager for each call', async () => {
      const callback = vi.fn().mockResolvedValue('result');

      await databaseInstance.withEntityManager(callback);
      await databaseInstance.withEntityManager(callback);

      expect(mockEntityManager.fork).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.clear).toHaveBeenCalledTimes(2);
    });
  });

  describe('withTransaction', () => {
    it('should execute callback in transaction', async () => {
      const callback = vi.fn().mockResolvedValue('transaction result');

      const result = await databaseInstance.withTransaction(callback);

      expect(result).toBe('transaction result');
      expect(mockEntityManager.fork).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.transactional).toHaveBeenCalledTimes(1);
    });

    it('should clear entity manager after transaction', async () => {
      const callback = vi.fn().mockResolvedValue('success');

      await databaseInstance.withTransaction(callback);

      expect(mockEntityManager.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear entity manager even if transaction fails', async () => {
      const error = new Error('Transaction failed');
      const callback = vi.fn().mockRejectedValue(error);

      mockEntityManager.transactional = vi.fn().mockImplementation(async cb => {
        return await cb(mockEntityManager);
      });

      await expect(databaseInstance.withTransaction(callback)).rejects.toThrow('Transaction failed');

      expect(mockEntityManager.clear).toHaveBeenCalledTimes(1);
    });

    it('should propagate transaction result', async () => {
      const expectedData = { id: 1, name: 'Created User' };
      const callback = vi.fn().mockResolvedValue(expectedData);

      const result = await databaseInstance.withTransaction(callback);

      expect(result).toEqual(expectedData);
    });

    it('should pass transactional entity manager to callback', async () => {
      const callback = vi.fn().mockResolvedValue('result');

      await databaseInstance.withTransaction(callback);

      expect(callback).toHaveBeenCalledWith(mockEntityManager);
    });
  });
});
