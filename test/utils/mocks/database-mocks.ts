import { mock } from 'node:test';

/**
 * Mock for MikroORM EntityManager
 */
export const mockEntityManager = {
  find: mock.fn(),
  findOne: mock.fn(),
  create: mock.fn(),
  persist: mock.fn(),
  flush: mock.fn(),
  remove: mock.fn(),
  getRepository: mock.fn(),
  begin: mock.fn(),
  commit: mock.fn(),
  rollback: mock.fn(),
  transactional: mock.fn(),
  close: mock.fn(),
};

/**
 * Mock for DatabaseInstance
 */
export const mockDatabaseInstance = {
  getEntityManager: mock.fn(() => mockEntityManager),
  isConnected: mock.fn(() => true),
  connect: mock.fn(),
  disconnect: mock.fn(),
  getName: mock.fn(() => 'test_db'),
};

/**
 * Mock for DatabaseManager
 */
export const mockDatabaseManager = {
  initialize: mock.fn(),
  getInstance: mock.fn(() => mockDatabaseInstance),
  getAllInstances: mock.fn(() => [mockDatabaseInstance]),
  closeAll: mock.fn(),
  isInitialized: mock.fn(() => true),
};
