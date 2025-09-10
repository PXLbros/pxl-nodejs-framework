import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import os from 'os';
import cluster from 'cluster';
import BaseApplication from '../../../src/application/base-application.js';
import { DatabaseManager } from '../../../src/database/index.js';
import QueueManager from '../../../src/queue/manager.js';
import RedisManager from '../../../src/redis/manager.js';
import CacheManager from '../../../src/cache/manager.js';
import ClusterManager from '../../../src/cluster/cluster-manager.js';
import EventManager from '../../../src/event/manager.js';
import { PerformanceMonitor } from '../../../src/performance/performance-monitor.js';
import { OS, Time } from '../../../src/util/index.js';
import Logger from '../../../src/logger/logger.js';
import { requestExit } from '../../../src/lifecycle/exit.js';
import type { ApplicationConfig } from '../../../src/application/base-application.interface.js';

// Mock all dependencies
vi.mock('fs');
vi.mock('url');
vi.mock('path');
vi.mock('os');
vi.mock('cluster');
vi.mock('../../../src/database/index.js');
vi.mock('../../../src/queue/manager.js');
vi.mock('../../../src/redis/manager.js');
vi.mock('../../../src/cache/manager.js');
vi.mock('../../../src/cluster/cluster-manager.js');
vi.mock('../../../src/event/manager.js');
vi.mock('../../../src/performance/performance-monitor.js');
vi.mock('../../../src/util/index.js');
vi.mock('../../../src/logger/logger.js');
vi.mock('../../../src/lifecycle/exit.js');

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockFileURLToPath = vi.mocked(fileURLToPath);
const mockDirname = vi.mocked(dirname);
const mockResolve = vi.mocked(resolve);
const mockJoin = vi.mocked(join);
const mockOs = vi.mocked(os);
const mockCluster = vi.mocked(cluster);
const mockDatabaseManager = vi.mocked(DatabaseManager);
const mockQueueManager = vi.mocked(QueueManager);
const mockRedisManager = vi.mocked(RedisManager);
const mockCacheManager = vi.mocked(CacheManager);
const mockClusterManager = vi.mocked(ClusterManager);
const mockEventManager = vi.mocked(EventManager);
const mockPerformanceMonitor = vi.mocked(PerformanceMonitor);
const mockOS = vi.mocked(OS);
const mockTime = vi.mocked(Time);
const mockLogger = vi.mocked(Logger);
const mockRequestExit = vi.mocked(requestExit);

// Create a concrete implementation for testing
class TestApplication extends BaseApplication {
  protected async startHandler(): Promise<void> {
    // Test implementation
  }

  protected stopCallback(): void {
    // Test implementation
  }
}

describe('BaseApplication', () => {
  let application: TestApplication;
  let mockConfig: ApplicationConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset static cache
    // @ts-ignore - accessing private static property
    BaseApplication.applicationVersionCache = undefined;

    mockConfig = {
      name: 'test-app',
      instanceId: 'test-instance',
      rootDirectory: '/test/root',
      redis: {
        host: 'localhost',
        port: 6379,
        password: 'redis-pass'
      },
      queue: {
        queues: [],
        processorsDirectory: '/test/processors'
      },
      database: {
        enabled: true,
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: 'dbpass',
        databaseName: 'testdb',
        entitiesDirectory: '/test/entities'
      }
    };

    // Mock OS functions
    mockOs.hostname.mockReturnValue('test-host');
    mockOS.getUniqueComputerId.mockReturnValue('unique-id-123');

    // Mock cluster
    mockCluster.isWorker = false;
    mockCluster.worker = null;

    // Mock path functions
    mockJoin.mockImplementation((...segments) => segments.join('/'));

    // Mock file system
    mockExistsSync.mockReturnValue(true);

    // Mock managers
    mockRedisManager.mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn()
    }) as any);

    mockCacheManager.mockImplementation(() => ({}) as any);
    mockDatabaseManager.mockImplementation(() => ({
      connect: vi.fn(),
      disconnect: vi.fn()
    }) as any);

    mockQueueManager.mockImplementation(() => ({
      registerQueues: vi.fn()
    }) as any);

    mockPerformanceMonitor.initialize.mockReturnValue({} as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with basic configuration', () => {
      application = new TestApplication(mockConfig);

      expect(application.Name).toBe('test-app');
      expect(application.uniqueInstanceId).toBe('test-instance-test-host-unique-id-123');
      expect(mockRedisManager).toHaveBeenCalledWith({
        applicationConfig: mockConfig,
        host: 'localhost',
        port: 6379,
        password: 'redis-pass'
      });
      expect(mockCacheManager).toHaveBeenCalledWith({
        applicationConfig: mockConfig,
        redisManager: expect.any(Object)
      });
    });

    it('should initialize database manager when database is enabled', () => {
      application = new TestApplication(mockConfig);

      expect(mockDatabaseManager).toHaveBeenCalledWith({
        applicationConfig: mockConfig,
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: 'dbpass',
        databaseName: 'testdb',
        entitiesDirectory: '/test/entities'
      });
    });

    it('should use default entities directory if not provided', () => {
      const configWithoutEntities = {
        ...mockConfig,
        database: {
          ...mockConfig.database!,
          entitiesDirectory: undefined
        }
      };

      application = new TestApplication(configWithoutEntities);

      expect(mockJoin).toHaveBeenCalledWith('/test/root', 'src', 'database', 'entities');
      expect(mockDatabaseManager).toHaveBeenCalledWith(
        expect.objectContaining({
          entitiesDirectory: '/test/root/src/database/entities'
        })
      );
    });

    it('should throw error if entities directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => new TestApplication(mockConfig)).toThrow(
        'Database entities directory not found (Path: /test/entities)'
      );
    });

    it('should not initialize database manager when disabled', () => {
      const configWithoutDb = {
        ...mockConfig,
        database: {
          ...mockConfig.database!,
          enabled: false
        }
      };

      application = new TestApplication(configWithoutDb);

      expect(mockDatabaseManager).not.toHaveBeenCalled();
    });

    it('should handle cluster worker ID', () => {
      mockCluster.isWorker = true;
      mockCluster.worker = { id: 5 } as any;

      application = new TestApplication(mockConfig);

      // @ts-ignore - accessing protected property
      expect(application.workerId).toBe(5);
    });
  });

  describe('getApplicationVersion', () => {
    beforeEach(() => {
      mockFileURLToPath.mockReturnValue('/test/src/application/base-application.js');
      mockDirname.mockReturnValue('/test/src/application');
      mockResolve.mockReturnValue('/test/package.json');
    });

    it('should read and return version from package.json', async () => {
      mockReadFileSync.mockReturnValue('{"version": "1.2.3"}');

      application = new TestApplication(mockConfig);
      const version = await application.getApplicationVersion();

      expect(version).toBe('1.2.3');
      expect(mockReadFileSync).toHaveBeenCalledWith('/test/package.json', 'utf-8');
    });

    it('should cache version after first read', async () => {
      mockReadFileSync.mockReturnValue('{"version": "1.2.3"}');

      application = new TestApplication(mockConfig);
      
      // First call
      await application.getApplicationVersion();
      // Second call
      const version = await application.getApplicationVersion();

      expect(version).toBe('1.2.3');
      expect(mockReadFileSync).toHaveBeenCalledTimes(1);
    });

    it('should throw error if version not found in package.json', async () => {
      mockReadFileSync.mockReturnValue('{"name": "test"}');

      application = new TestApplication(mockConfig);

      await expect(application.getApplicationVersion()).rejects.toThrow(
        'Application version not found'
      );
    });

    it('should throw error if package.json is invalid JSON', async () => {
      mockReadFileSync.mockReturnValue('invalid json');

      application = new TestApplication(mockConfig);

      await expect(application.getApplicationVersion()).rejects.toThrow();
    });
  });

  describe('start', () => {
    beforeEach(() => {
      application = new TestApplication(mockConfig);
      
      // Mock process.hrtime
      vi.spyOn(process, 'hrtime').mockReturnValue([1, 500000000]);
      
      // Mock version
      mockReadFileSync.mockReturnValue('{"version": "1.0.0"}');
      mockFileURLToPath.mockReturnValue('/test/src/application/base-application.js');
      mockDirname.mockReturnValue('/test/src/application');
      mockResolve.mockReturnValue('/test/package.json');

      // Mock Time.calculateElapsedTime
      mockTime.calculateElapsedTime.mockReturnValue(1500);

      // Mock redis and database connections
      const mockRedisInstance = { client: {} };
      const mockDatabaseInstance = { orm: {} };
      const mockQueueManagerInstance = { registerQueues: vi.fn() };

      application.redisManager.connect = vi.fn().mockResolvedValue(mockRedisInstance);
      if (application.databaseManager) {
        application.databaseManager.connect = vi.fn().mockResolvedValue(mockDatabaseInstance);
      }

      mockQueueManager.mockImplementation(() => mockQueueManagerInstance as any);
    });

    it('should start standalone application', async () => {
      const configWithoutCluster = { ...mockConfig };
      delete configWithoutCluster.cluster;

      application = new TestApplication(configWithoutCluster);
      
      // Mock the required connections
      const mockRedisInstance = { client: {} };
      const mockDatabaseInstance = { orm: {} };
      
      application.redisManager.connect = vi.fn().mockResolvedValue(mockRedisInstance);
      if (application.databaseManager) {
        application.databaseManager.connect = vi.fn().mockResolvedValue(mockDatabaseInstance);
      }

      await application.start();

      expect(application.redisManager.connect).toHaveBeenCalled();
      expect(application.databaseManager?.connect).toHaveBeenCalled();
    });

    it('should start clustered application', async () => {
      const configWithCluster = {
        ...mockConfig,
        cluster: {
          enabled: true,
          workers: 2
        }
      };

      application = new TestApplication(configWithCluster);

      const mockClusterManagerInstance = {
        start: vi.fn()
      };
      mockClusterManager.mockImplementation(() => mockClusterManagerInstance as any);

      await application.start();

      expect(mockClusterManager).toHaveBeenCalledWith({
        config: configWithCluster.cluster,
        startApplicationCallback: expect.any(Function),
        stopApplicationCallback: expect.any(Function)
      });
      expect(mockClusterManagerInstance.start).toHaveBeenCalled();
    });

    it('should initialize event manager when enabled', async () => {
      const configWithEvents = {
        ...mockConfig,
        event: {
          enabled: true,
          events: []
        }
      };

      application = new TestApplication(configWithEvents);

      // Mock the required connections
      const mockRedisInstance = { client: {} };
      const mockDatabaseInstance = { orm: {} };
      
      application.redisManager.connect = vi.fn().mockResolvedValue(mockRedisInstance);
      if (application.databaseManager) {
        application.databaseManager.connect = vi.fn().mockResolvedValue(mockDatabaseInstance);
      }

      const mockEventManagerInstance = {
        load: vi.fn()
      };
      mockEventManager.mockImplementation(() => mockEventManagerInstance as any);

      await application.start();

      expect(mockEventManager).toHaveBeenCalledWith({
        applicationConfig: configWithEvents,
        options: configWithEvents.event,
        events: [],
        redisInstance: mockRedisInstance,
        databaseInstance: mockDatabaseInstance
      });
      expect(mockEventManagerInstance.load).toHaveBeenCalled();
    });
  });

  describe('global error handlers', () => {
    beforeEach(() => {
      application = new TestApplication(mockConfig);
      
      // Mock the stop method
      vi.spyOn(application as any, 'stop').mockResolvedValue(undefined);
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught error');
      
      // Trigger the uncaught exception handler
      process.emit('uncaughtException', error);

      expect(mockLogger.error).toHaveBeenCalledWith({
        error,
        message: 'Uncaught Exception'
      });
    });

    it('should handle unhandled promise rejections', () => {
      const error = new Error('Unhandled rejection');
      const promise = Promise.reject(error);
      
      // Trigger the unhandled rejection handler
      process.emit('unhandledRejection', error, promise);

      expect(mockLogger.error).toHaveBeenCalledWith({
        error,
        message: 'Unhandled Rejection',
        meta: { promise }
      });
    });

    it('should handle string rejections', () => {
      const reason = 'String error';
      const promise = Promise.reject(reason);
      
      // Trigger the unhandled rejection handler
      process.emit('unhandledRejection', reason, promise);

      expect(mockLogger.error).toHaveBeenCalledWith({
        error: expect.any(Error),
        message: 'Unhandled Rejection',
        meta: { promise }
      });
    });
  });

  describe('performance monitoring', () => {
    it('should initialize performance monitor when enabled', () => {
      const configWithPerformance = {
        ...mockConfig,
        performanceMonitoring: {
          enabled: true,
          thresholds: { slow: 1000 },
          maxMetricsHistory: 100,
          logSlowOperations: true,
          logAllOperations: false,
          reportInterval: 60000,
          reportFormat: 'detailed' as const
        }
      };

      application = new TestApplication(configWithPerformance);

      expect(mockPerformanceMonitor.initialize).toHaveBeenCalledWith({
        enabled: true,
        thresholds: { slow: 1000 },
        maxMetricsHistory: 100,
        logSlowOperations: true,
        logAllOperations: false
      });
    });

    it('should not initialize performance monitor when disabled', () => {
      const configWithoutPerformance = {
        ...mockConfig,
        performanceMonitoring: {
          enabled: false
        }
      };

      application = new TestApplication(configWithoutPerformance);

      expect(mockPerformanceMonitor.initialize).not.toHaveBeenCalled();
    });
  });

  describe('shutdown handling', () => {
    beforeEach(() => {
      application = new TestApplication(mockConfig);
      
      // Mock the stop method
      vi.spyOn(application as any, 'stop').mockResolvedValue(undefined);
    });

    it('should handle shutdown signals', () => {
      const mockOnStopped = vi.fn();
      
      application.handleShutdown({ onStopped: mockOnStopped });

      // Simulate SIGTERM
      process.emit('SIGTERM');

      expect(application['stop']).toHaveBeenCalledWith({ onStopped: mockOnStopped });
    });

    it('should handle multiple shutdown signals', () => {
      application.handleShutdown({ onStopped: vi.fn() });

      // Verify both signals are registered
      const signals = ['SIGTERM', 'SIGINT'];
      signals.forEach(signal => {
        expect(process.listenerCount(signal as any)).toBeGreaterThan(0);
      });
    });
  });
});