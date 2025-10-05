import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabasePerformanceWrapper, MonitorDatabaseOperation } from '../../../src/performance/database-performance.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';

describe('DatabasePerformanceWrapper', () => {
  let mockMonitor: PerformanceMonitor;

  beforeEach(() => {
    mockMonitor = {
      measureAsync: vi.fn().mockImplementation(async ({ fn }) => fn()),
    } as any;

    DatabasePerformanceWrapper.setPerformanceMonitor(mockMonitor);
  });

  describe('setPerformanceMonitor', () => {
    it('should set the performance monitor', () => {
      const newMonitor = {} as PerformanceMonitor;
      DatabasePerformanceWrapper.setPerformanceMonitor(newMonitor);
      expect(DatabasePerformanceWrapper['performanceMonitor']).toBe(newMonitor);
    });
  });

  describe('monitorRepositoryOperation', () => {
    it('should monitor repository operation with array result', async () => {
      const operation = vi.fn().mockResolvedValue([1, 2, 3]);
      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation('findAll', 'User', operation, {
        query: 'SELECT * FROM users',
      });

      expect(result).toEqual([1, 2, 3]);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'User.findAll',
          type: 'database',
          metadata: expect.objectContaining({
            operation: 'findAll',
            entity: 'User',
            resultCount: 3,
            query: 'SELECT * FROM users',
          }),
        }),
      );
    });

    it('should monitor repository operation with single object result', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

      await DatabasePerformanceWrapper.monitorRepositoryOperation('findOne', 'User', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            resultCount: 1,
          }),
        }),
      );
    });

    it('should monitor repository operation with null result', async () => {
      const operation = vi.fn().mockResolvedValue(null);

      await DatabasePerformanceWrapper.monitorRepositoryOperation('findOne', 'User', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            resultCount: 0,
          }),
        }),
      );
    });
  });

  describe('monitorQuery', () => {
    it('should monitor raw query with parameters', async () => {
      const query = 'SELECT * FROM users WHERE id = ?';
      const parameters = [123];
      const operation = vi.fn().mockResolvedValue([{ id: 123 }]);

      await DatabasePerformanceWrapper.monitorQuery(query, parameters, operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'raw_query',
          type: 'database',
          metadata: expect.objectContaining({
            operation: 'raw_query',
            query,
            parameters,
            resultCount: 1,
          }),
        }),
      );
    });

    it('should truncate long queries', async () => {
      const longQuery = 'SELECT * FROM users WHERE '.repeat(20) + 'id = ?';
      const operation = vi.fn().mockResolvedValue([]);

      await DatabasePerformanceWrapper.monitorQuery(longQuery, [], operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            query: expect.stringMatching(/\.\.\.$/),
          }),
        }),
      );
    });

    it('should limit parameters for logging', async () => {
      const parameters = Array.from({ length: 20 }, (_, i) => i);
      const operation = vi.fn().mockResolvedValue([]);

      await DatabasePerformanceWrapper.monitorQuery('SELECT *', parameters, operation);

      const call = (mockMonitor.measureAsync as any).mock.calls[0][0];
      expect(call.metadata.parameters).toHaveLength(10);
    });

    it('should count array results', async () => {
      const operation = vi.fn().mockResolvedValue([1, 2, 3, 4, 5]);

      await DatabasePerformanceWrapper.monitorQuery('SELECT *', [], operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            resultCount: 5,
          }),
        }),
      );
    });
  });

  describe('monitorTransaction', () => {
    it('should monitor transaction', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });

      await DatabasePerformanceWrapper.monitorTransaction('createUser', operation, { userId: 123 });

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'transaction.createUser',
          type: 'database',
          metadata: expect.objectContaining({
            operation: 'transaction',
            entity: 'createUser',
            userId: 123,
          }),
        }),
      );
    });
  });

  describe('monitorConnection', () => {
    it('should monitor connection operations', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await DatabasePerformanceWrapper.monitorConnection('connect', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'connection.connect',
          type: 'database',
          metadata: expect.objectContaining({
            operation: 'connect',
          }),
        }),
      );
    });
  });

  describe('monitorMigration', () => {
    it('should monitor migration operations', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      await DatabasePerformanceWrapper.monitorMigration('2024_01_create_users', operation);

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'migration.2024_01_create_users',
          type: 'database',
          metadata: expect.objectContaining({
            operation: 'migration',
            entity: '2024_01_create_users',
          }),
        }),
      );
    });
  });

  describe('MonitorDatabaseOperation decorator', () => {
    it('should monitor decorated method', async () => {
      class UserRepository {
        @MonitorDatabaseOperation('findAll')
        async getAllUsers() {
          return [{ id: 1 }, { id: 2 }];
        }
      }

      const repo = new UserRepository();
      const result = await repo.getAllUsers();

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            operation: 'findAll',
            entity: 'User',
            argumentCount: 0,
          }),
        }),
      );
    });

    it('should use method name as operation name when not specified', async () => {
      class ProductRepository {
        @MonitorDatabaseOperation()
        async fetchProducts(category: string) {
          return [{ id: 1, category }];
        }
      }

      const repo = new ProductRepository();
      await repo.fetchProducts('electronics');

      expect(mockMonitor.measureAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            operation: 'fetchProducts',
            entity: 'Product',
            argumentCount: 1,
          }),
        }),
      );
    });
  });
});
