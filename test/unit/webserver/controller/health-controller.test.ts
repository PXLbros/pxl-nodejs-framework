import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock } from 'node:test';
import HealthController from '../../../../src/webserver/controller/health.js';
import { mockRedisInstance } from '../../../utils/mocks/redis-mocks.js';
import { mockDatabaseInstance } from '../../../utils/mocks/database-mocks.js';
import { mockQueueManager } from '../../../utils/mocks/queue-mocks.js';
import { LifecyclePhase } from '../../../../src/lifecycle/types.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

describe('HealthController', () => {
  let controller: HealthController;
  let mockReply: FastifyReply;
  let mockRequest: FastifyRequest;
  let mockEventManager: any;
  let mockLifecycleManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEventManager = {
      emit: mock.fn(),
      on: mock.fn(),
    };

    mockLifecycleManager = {
      phase: LifecyclePhase.RUNNING,
      getReadinessStatus: vi.fn().mockResolvedValue({
        ready: true,
        checks: [],
      }),
      registerComponent: mock.fn(),
      shutdown: mock.fn(),
    };

    controller = new HealthController({
      applicationConfig: {
        name: 'test-app',
        instanceId: 'test-instance',
        rootDirectory: '/test',
      },
      webServerOptions: {
        host: '0.0.0.0',
        port: 3001,
        controllersDirectory: '/test/controllers',
      },
      redisInstance: mockRedisInstance as any,
      queueManager: mockQueueManager as any,
      eventManager: mockEventManager,
      databaseInstance: mockDatabaseInstance as any,
      lifecycleManager: mockLifecycleManager as any,
    });

    mockRequest = {} as any;

    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as any;
  });

  describe('live', () => {
    it('should return live=true when lifecycle is RUNNING', async () => {
      mockLifecycleManager.phase = LifecyclePhase.RUNNING;

      await controller.live(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        live: true,
        phase: LifecyclePhase.RUNNING,
      });
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should return live=true when lifecycle is STARTING', async () => {
      mockLifecycleManager.phase = LifecyclePhase.STARTING;

      await controller.live(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        live: true,
        phase: LifecyclePhase.STARTING,
      });
    });

    it('should return live=false with 503 when lifecycle is STOPPING', async () => {
      mockLifecycleManager.phase = LifecyclePhase.STOPPING;

      await controller.live(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        live: false,
        phase: LifecyclePhase.STOPPING,
      });
    });

    it('should return live=false with 503 when lifecycle is STOPPED', async () => {
      mockLifecycleManager.phase = LifecyclePhase.STOPPED;

      await controller.live(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        live: false,
        phase: LifecyclePhase.STOPPED,
      });
    });
  });

  describe('ready', () => {
    it('should return ready=true when all checks pass', async () => {
      mockLifecycleManager.phase = LifecyclePhase.RUNNING;
      mockLifecycleManager.getReadinessStatus.mockResolvedValue({
        ready: true,
        checks: [
          { name: 'database', ready: true },
          { name: 'redis', ready: true },
        ],
      });

      await controller.ready(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        ready: true,
        phase: LifecyclePhase.RUNNING,
        probes: {
          database: { healthy: true, required: true },
          redis: { healthy: true, required: true },
        },
        aggregatedReadiness: true,
      });
      expect(mockReply.code).not.toHaveBeenCalled();
    });

    it('should return ready=false with 503 when lifecycle is not RUNNING', async () => {
      mockLifecycleManager.phase = LifecyclePhase.STARTING;
      mockLifecycleManager.getReadinessStatus.mockResolvedValue({
        ready: false,
        checks: [],
      });

      await controller.ready(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: false,
          phase: LifecyclePhase.STARTING,
          notReady: 'lifecycle-phase',
          aggregatedReadiness: true,
        }),
      );
    });

    it('should return ready=false with 503 when readiness checks fail', async () => {
      mockLifecycleManager.phase = LifecyclePhase.RUNNING;
      mockLifecycleManager.getReadinessStatus.mockResolvedValue({
        ready: false,
        checks: [
          { name: 'database', ready: false },
          { name: 'redis', ready: true },
        ],
      });

      await controller.ready(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith({
        ready: false,
        phase: LifecyclePhase.RUNNING,
        probes: {
          database: { healthy: false, required: true },
          redis: { healthy: true, required: true },
        },
        notReady: 'readiness-checks-failed',
        failed: ['database'],
        aggregatedReadiness: true,
      });
    });

    it('should handle multiple failed readiness checks', async () => {
      mockLifecycleManager.phase = LifecyclePhase.RUNNING;
      mockLifecycleManager.getReadinessStatus.mockResolvedValue({
        ready: false,
        checks: [
          { name: 'database', ready: false },
          { name: 'redis', ready: false },
          { name: 'queue', ready: true },
        ],
      });

      await controller.ready(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(503);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: false,
          failed: ['database', 'redis'],
        }),
      );
    });

    it('should return ready=true when lifecycle is RUNNING and no checks', async () => {
      mockLifecycleManager.phase = LifecyclePhase.RUNNING;
      mockLifecycleManager.getReadinessStatus.mockResolvedValue({
        ready: true,
        checks: [],
      });

      await controller.ready(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        ready: true,
        phase: LifecyclePhase.RUNNING,
        probes: {},
        aggregatedReadiness: true,
      });
    });
  });
});
