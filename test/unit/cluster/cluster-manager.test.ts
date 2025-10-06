import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import cluster from 'node:cluster';
import ClusterManager from '../../../src/cluster/cluster-manager.js';
import type { ClusterManagerConfig } from '../../../src/cluster/cluster-manager.interface.js';
import { Logger } from '../../../src/logger/index.js';

// Mock dependencies
vi.mock('../../../src/logger/index.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/lifecycle/exit.js', () => ({
  requestExit: vi.fn(),
}));

describe('ClusterManager', () => {
  let clusterManager: ClusterManager;
  let startCallback: ReturnType<typeof vi.fn>;
  let stopCallback: ReturnType<typeof vi.fn>;
  let config: ClusterManagerConfig;

  beforeEach(() => {
    startCallback = vi.fn().mockResolvedValue(undefined);
    stopCallback = vi.fn().mockResolvedValue(undefined);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with auto worker mode', () => {
      config = {
        workerMode: 'auto',
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      expect(clusterManager).toBeDefined();
    });

    it('should initialize with manual worker mode', () => {
      config = {
        workerMode: 'manual',
        workerCount: 4,
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      expect(clusterManager).toBeDefined();
    });
  });

  describe('start in primary mode', () => {
    beforeEach(() => {
      // Mock cluster.isPrimary as true
      vi.spyOn(cluster, 'isPrimary', 'get').mockReturnValue(true);
      vi.spyOn(cluster, 'fork').mockReturnValue({} as any);
      vi.spyOn(cluster, 'on').mockReturnValue({} as any);
      vi.spyOn(process, 'on').mockReturnValue({} as any);
    });

    it('should setup primary with auto worker mode', () => {
      config = {
        workerMode: 'auto',
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      expect(cluster.fork).toHaveBeenCalled();
      expect(Logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Started cluster master',
        }),
      );
    });

    it('should setup primary with manual worker mode', () => {
      config = {
        workerMode: 'manual',
        workerCount: 2,
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      expect(cluster.fork).toHaveBeenCalledTimes(2);
    });

    it('should handle worker online event', () => {
      config = {
        workerMode: 'manual',
        workerCount: 1,
      };

      const mockWorker = {
        id: 1,
        process: { pid: 1234 },
      };

      vi.spyOn(cluster, 'on').mockImplementation((event: string, callback: any) => {
        if (event === 'online') {
          callback(mockWorker);
        }
        return cluster;
      });

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      expect(Logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Started cluster worker',
          meta: expect.objectContaining({
            ID: 1,
            PID: 1234,
          }),
        }),
      );
    });

    it('should restart worker on unexpected exit', () => {
      config = {
        workerMode: 'manual',
        workerCount: 1,
      };

      const mockWorker = {
        id: 1,
        process: { pid: 1234 },
      };

      vi.spyOn(cluster, 'on').mockImplementation((event: string, callback: any) => {
        if (event === 'exit') {
          // Pass worker, exitCode, and signal to match the updated signature
          callback(mockWorker, 1, 'SIGTERM');
        }
        return cluster;
      });

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      // Should fork initially + fork again on exit
      expect(cluster.fork).toHaveBeenCalled();
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Cluster worker died unexpectedly, restarting',
          meta: expect.objectContaining({
            ID: 1,
            PID: 1234,
            exitCode: 1,
            signal: 'SIGTERM',
          }),
        }),
      );
    });
  });

  describe('start in worker mode', () => {
    beforeEach(() => {
      // Mock cluster.isPrimary as false (worker mode)
      vi.spyOn(cluster, 'isPrimary', 'get').mockReturnValue(false);
      vi.spyOn(process, 'on').mockReturnValue({} as any);
    });

    it('should setup worker and call start callback', async () => {
      config = {
        workerMode: 'auto',
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      // Allow async operation to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(startCallback).toHaveBeenCalled();
    });

    it('should handle shutdown message in worker', async () => {
      config = {
        workerMode: 'auto',
      };

      let messageHandler: (message: any) => Promise<void> | undefined;

      vi.spyOn(process, 'on').mockImplementation((event: string, callback: any) => {
        if (event === 'message') {
          messageHandler = callback;
        }
        return process;
      });

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      // Wait for worker setup
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate shutdown message
      if (messageHandler) {
        await messageHandler('shutdown');

        expect(Logger.debug).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Worker received shutdown message, stopping...',
          }),
        );
        expect(stopCallback).toHaveBeenCalled();
      }
    });
  });

  describe('handleShutdown', () => {
    beforeEach(() => {
      vi.spyOn(cluster, 'isPrimary', 'get').mockReturnValue(true);
      vi.spyOn(cluster, 'fork').mockReturnValue({} as any);
      vi.spyOn(cluster, 'on').mockReturnValue({} as any);
      vi.spyOn(process, 'on').mockReturnValue({} as any);
    });

    it('should register shutdown signal handlers', () => {
      config = {
        workerMode: 'manual',
        workerCount: 1,
      };

      clusterManager = new ClusterManager({
        config,
        startApplicationCallback: startCallback,
        stopApplicationCallback: stopCallback,
      });

      clusterManager.start();

      expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(process.on).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });
});
