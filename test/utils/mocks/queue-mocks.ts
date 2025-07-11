import { mock } from 'node:test';

/**
 * Mock for BullMQ Queue
 */
export const mockQueue = {
  add: mock.fn(),
  process: mock.fn(),
  on: mock.fn(),
  off: mock.fn(),
  close: mock.fn(),
  getJobs: mock.fn(),
  getJob: mock.fn(),
  removeJobs: mock.fn(),
  clean: mock.fn(),
  pause: mock.fn(),
  resume: mock.fn(),
  isPaused: mock.fn(),
};

/**
 * Mock for BullMQ Worker
 */
export const mockWorker = {
  on: mock.fn(),
  off: mock.fn(),
  close: mock.fn(),
  pause: mock.fn(),
  resume: mock.fn(),
  isPaused: mock.fn(),
  isRunning: mock.fn(),
};

/**
 * Mock for QueueInstance
 */
export const mockQueueInstance = {
  getQueue: mock.fn(() => mockQueue),
  getWorker: mock.fn(() => mockWorker),
  addJob: mock.fn(),
  processJobs: mock.fn(),
  close: mock.fn(),
  getName: mock.fn(() => 'test_queue'),
};

/**
 * Mock for QueueManager
 */
export const mockQueueManager = {
  initialize: mock.fn(),
  getInstance: mock.fn(() => mockQueueInstance),
  getAllInstances: mock.fn(() => [mockQueueInstance]),
  closeAll: mock.fn(),
  isInitialized: mock.fn(() => true),
};
