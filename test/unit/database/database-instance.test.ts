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
});
