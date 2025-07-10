import { vi } from 'vitest';

/**
 * Mock for BullMQ Queue
 */
export const mockQueue = {
  add: vi.fn(),
  process: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn(),
  getJobs: vi.fn(),
  getJob: vi.fn(),
  removeJobs: vi.fn(),
  clean: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  isPaused: vi.fn(),
};

/**
 * Mock for BullMQ Worker
 */
export const mockWorker = {
  on: vi.fn(),
  off: vi.fn(),
  close: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  isPaused: vi.fn(),
  isRunning: vi.fn(),
};

/**
 * Mock for QueueInstance
 */
export const mockQueueInstance = {
  getQueue: vi.fn(() => mockQueue),
  getWorker: vi.fn(() => mockWorker),
  addJob: vi.fn(),
  processJobs: vi.fn(),
  close: vi.fn(),
  getName: vi.fn(() => 'test_queue'),
};

/**
 * Mock for QueueManager
 */
export const mockQueueManager = {
  initialize: vi.fn(),
  getInstance: vi.fn(() => mockQueueInstance),
  getAllInstances: vi.fn(() => [mockQueueInstance]),
  closeAll: vi.fn(),
  isInitialized: vi.fn(() => true),
};
