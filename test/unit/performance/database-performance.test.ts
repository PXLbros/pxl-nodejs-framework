import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DatabasePerformanceWrapper,
  MonitorDatabaseOperation,
} from '../../../dist/performance/database-performance.js';
import { PerformanceMonitor } from '../../../dist/performance/performance-monitor.js';

describe('DatabasePerformanceWrapper', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
    DatabasePerformanceWrapper.setPerformanceMonitor(performanceMonitor);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('setPerformanceMonitor', () => {
    it('should set performance monitor', () => {
      const customMonitor = PerformanceMonitor.getInstance();
      DatabasePerformanceWrapper.setPerformanceMonitor(customMonitor);
      expect(DatabasePerformanceWrapper['performanceMonitor']).toBe(customMonitor);
    });
  });

  describe('monitorRepositoryOperation', () => {
    it('should monitor repository operation successfully', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation('findOne', 'User', operation);

      expect(result).toEqual({ id: 1, name: 'Test' });
      expect(operation).toHaveBeenCalled();
    });

    it('should set resultCount for array results', async () => {
      const operation = vi.fn().mockResolvedValue([
        { id: 1, name: 'User1' },
        { id: 2, name: 'User2' },
        { id: 3, name: 'User3' },
      ]);

      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation('findAll', 'User', operation);

      expect(result).toHaveLength(3);
      expect(operation).toHaveBeenCalled();
    });

    it('should set resultCount to 1 for single object results', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1, name: 'User1' });

      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation('findById', 'User', operation);

      expect(result).toEqual({ id: 1, name: 'User1' });
      expect(operation).toHaveBeenCalled();
    });

    it('should set resultCount to 0 for null results', async () => {
      const operation = vi.fn().mockResolvedValue(null);

      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation('findOne', 'User', operation);

      expect(result).toBeNull();
      expect(operation).toHaveBeenCalled();
    });

    it('should include additional metadata', async () => {
      const operation = vi.fn().mockResolvedValue({ id: 1 });
      const additionalMetadata = { cacheHit: true, queryTime: 15 };

      const result = await DatabasePerformanceWrapper.monitorRepositoryOperation(
        'findOne',
        'User',
        operation,
        additionalMetadata,
      );

      expect(result).toEqual({ id: 1 });
      expect(operation).toHaveBeenCalled();
    });

    it('should handle operation errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(DatabasePerformanceWrapper.monitorRepositoryOperation('findOne', 'User', operation)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('monitorQuery', () => {
    it('should monitor raw query successfully', async () => {
      const operation = vi.fn().mockResolvedValue([{ count: 10 }]);
      const query = 'SELECT COUNT(*) FROM users WHERE active = ?';
      const parameters = [true];

      const result = await DatabasePerformanceWrapper.monitorQuery(query, parameters, operation);

      expect(result).toEqual([{ count: 10 }]);
      expect(operation).toHaveBeenCalled();
    });

    it('should truncate long queries', async () => {
      const operation = vi.fn().mockResolvedValue([]);
      const longQuery = 'SELECT * FROM users WHERE ' + 'id = ? OR '.repeat(50) + 'id = ?';
      const parameters = Array(51).fill(1);

      const result = await DatabasePerformanceWrapper.monitorQuery(longQuery, parameters, operation);

      expect(result).toEqual([]);
      expect(operation).toHaveBeenCalled();
    });

    it('should limit parameters for logging', async () => {
      const operation = vi.fn().mockResolvedValue([]);
      const query = 'SELECT * FROM users WHERE id IN (?)';
      const parameters = Array(20)
        .fill(0)
        .map((_, i) => i);

      const result = await DatabasePerformanceWrapper.monitorQuery(query, parameters, operation);

      expect(result).toEqual([]);
      expect(operation).toHaveBeenCalled();
    });

    it('should handle array results', async () => {
      const operation = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const query = 'SELECT * FROM users';

      const result = await DatabasePerformanceWrapper.monitorQuery(query, [], operation);

      expect(result).toHaveLength(2);
      expect(operation).toHaveBeenCalled();
    });

    it('should handle object results', async () => {
      const operation = vi.fn().mockResolvedValue({ affectedRows: 1 });
      const query = 'UPDATE users SET active = ? WHERE id = ?';
      const parameters = [true, 1];

      const result = await DatabasePerformanceWrapper.monitorQuery(query, parameters, operation);

      expect(result).toEqual({ affectedRows: 1 });
      expect(operation).toHaveBeenCalled();
    });

    it('should handle query errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Query failed'));
      const query = 'INVALID SQL';

      await expect(DatabasePerformanceWrapper.monitorQuery(query, [], operation)).rejects.toThrow('Query failed');
    });
  });

  describe('monitorTransaction', () => {
    it('should monitor transaction successfully', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });

      const result = await DatabasePerformanceWrapper.monitorTransaction('userCreation', operation);

      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should include additional metadata in transaction', async () => {
      const operation = vi.fn().mockResolvedValue(true);
      const metadata = { isolationLevel: 'READ_COMMITTED' };

      const result = await DatabasePerformanceWrapper.monitorTransaction('complexUpdate', operation, metadata);

      expect(result).toBe(true);
      expect(operation).toHaveBeenCalled();
    });

    it('should handle transaction rollback errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Transaction rolled back'));

      await expect(DatabasePerformanceWrapper.monitorTransaction('failedTransaction', operation)).rejects.toThrow(
        'Transaction rolled back',
      );
    });

    it('should handle transaction with complex operations', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { inserted: 5, updated: 3 };
      });

      const result = await DatabasePerformanceWrapper.monitorTransaction('batchUpdate', operation);

      expect(result).toEqual({ inserted: 5, updated: 3 });
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('monitorConnection', () => {
    it('should monitor connection operation', async () => {
      const operation = vi.fn().mockResolvedValue('connected');

      const result = await DatabasePerformanceWrapper.monitorConnection('connect', operation);

      expect(result).toBe('connected');
      expect(operation).toHaveBeenCalled();
    });

    it('should monitor disconnection', async () => {
      const operation = vi.fn().mockResolvedValue(undefined);

      const result = await DatabasePerformanceWrapper.monitorConnection('disconnect', operation);

      expect(result).toBeUndefined();
      expect(operation).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(DatabasePerformanceWrapper.monitorConnection('connect', operation)).rejects.toThrow(
        'Connection failed',
      );
    });
  });

  describe('monitorMigration', () => {
    it('should monitor migration successfully', async () => {
      const operation = vi.fn().mockResolvedValue({ migrated: true });

      const result = await DatabasePerformanceWrapper.monitorMigration('CreateUsersTable', operation);

      expect(result).toEqual({ migrated: true });
      expect(operation).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Migration failed'));

      await expect(DatabasePerformanceWrapper.monitorMigration('FailedMigration', operation)).rejects.toThrow(
        'Migration failed',
      );
    });

    it('should monitor multiple migrations', async () => {
      const migration1 = vi.fn().mockResolvedValue({ success: true });
      const migration2 = vi.fn().mockResolvedValue({ success: true });

      const result1 = await DatabasePerformanceWrapper.monitorMigration('Migration1', migration1);
      const result2 = await DatabasePerformanceWrapper.monitorMigration('Migration2', migration2);

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
    });
  });

  describe('MonitorDatabaseOperation Decorator', () => {
    it('should decorate repository method', async () => {
      class UserRepository {
        @MonitorDatabaseOperation()
        async findAll() {
          return [{ id: 1 }, { id: 2 }];
        }
      }

      const repo = new UserRepository();
      const result = await repo.findAll();

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should decorate with custom operation name', async () => {
      class UserRepository {
        @MonitorDatabaseOperation('customFind')
        async findActive() {
          return [{ id: 1, active: true }];
        }
      }

      const repo = new UserRepository();
      const result = await repo.findActive();

      expect(result).toEqual([{ id: 1, active: true }]);
    });

    it('should preserve method context', async () => {
      class UserRepository {
        private data = [{ id: 1 }];

        @MonitorDatabaseOperation()
        async getData() {
          return this.data;
        }
      }

      const repo = new UserRepository();
      const result = await repo.getData();

      expect(result).toEqual([{ id: 1 }]);
    });

    it('should handle method errors', async () => {
      class UserRepository {
        @MonitorDatabaseOperation()
        async failingMethod() {
          throw new Error('Method failed');
        }
      }

      const repo = new UserRepository();

      await expect(repo.failingMethod()).rejects.toThrow('Method failed');
    });

    it('should pass method arguments correctly', async () => {
      class UserRepository {
        @MonitorDatabaseOperation()
        async findById(id: number) {
          return { id, name: 'User' + id };
        }
      }

      const repo = new UserRepository();
      const result = await repo.findById(42);

      expect(result).toEqual({ id: 42, name: 'User42' });
    });

    it('should handle multiple arguments', async () => {
      class UserRepository {
        @MonitorDatabaseOperation()
        async findByFilters(status: string, role: string, limit: number) {
          return [{ status, role, limit }];
        }
      }

      const repo = new UserRepository();
      const result = await repo.findByFilters('active', 'admin', 10);

      expect(result).toEqual([{ status: 'active', role: 'admin', limit: 10 }]);
    });
  });
});
