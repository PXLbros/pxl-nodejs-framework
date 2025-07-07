import { vi } from 'vitest'

/**
 * Mock for MikroORM EntityManager
 */
export const mockEntityManager = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  persist: vi.fn(),
  flush: vi.fn(),
  remove: vi.fn(),
  getRepository: vi.fn(),
  begin: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  transactional: vi.fn(),
  close: vi.fn(),
}

/**
 * Mock for DatabaseInstance
 */
export const mockDatabaseInstance = {
  getEntityManager: vi.fn(() => mockEntityManager),
  isConnected: vi.fn(() => true),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getName: vi.fn(() => 'test_db'),
}

/**
 * Mock for DatabaseManager
 */
export const mockDatabaseManager = {
  initialize: vi.fn(),
  getInstance: vi.fn(() => mockDatabaseInstance),
  getAllInstances: vi.fn(() => [mockDatabaseInstance]),
  closeAll: vi.fn(),
  isInitialized: vi.fn(() => true),
}