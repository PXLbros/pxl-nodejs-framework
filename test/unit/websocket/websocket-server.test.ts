import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocketServer from '../../../src/websocket/websocket-server.js';
import type { WebSocketOptions } from '../../../src/websocket/websocket.interface.js';
import type RedisInstance from '../../../src/redis/instance.js';
import type QueueManager from '../../../src/queue/manager.js';
import type DatabaseInstance from '../../../src/database/instance.js';
import type { WebApplicationConfig } from '../../../src/application/web-application.interface.js';
import { LifecycleManager } from '../../../src/lifecycle/lifecycle-manager.js';

const baseApplicationConfig: WebApplicationConfig = {
  name: 'TestApp',
  instanceId: 'test-instance',
  rootDirectory: '/tmp',
  redis: {
    host: 'localhost',
    port: 6379,
  },
  queue: {
    queues: [],
    processorsDirectory: '/tmp/processors',
  },
  auth: {
    jwtSecretKey: 'secret',
  },
};

const defaultOptions: WebSocketOptions = {
  type: 'server',
  url: 'ws://localhost',
  controllersDirectory: '/tmp/controllers',
  disconnectInactiveClients: {
    enabled: false,
  },
};

const createFakeWebSocketServer = () => ({
  on: vi.fn(),
  clients: new Set(),
  removeAllListeners: vi.fn(),
  close: vi.fn(),
});

const createRedisSubscriberMock = () => ({
  removeListener: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
});

interface ServerTestContext {
  server: WebSocketServer;
  redisSubscriberMock: ReturnType<typeof createRedisSubscriberMock>;
}

const createServer = (overrides: { options?: Partial<WebSocketOptions> } = {}): ServerTestContext => {
  const redisSubscriberMock = createRedisSubscriberMock();
  const redisInstance = {
    subscriberClient: redisSubscriberMock,
    publisherClient: { publish: vi.fn() },
  } as unknown as RedisInstance;

  const queueManager = {} as QueueManager;
  const databaseInstance = {} as DatabaseInstance;

  const options: WebSocketOptions = {
    ...defaultOptions,
    ...overrides.options,
    disconnectInactiveClients: {
      ...defaultOptions.disconnectInactiveClients,
      ...overrides.options?.disconnectInactiveClients,
    },
  };

  const server = new WebSocketServer({
    uniqueInstanceId: 'unique-instance',
    applicationConfig: baseApplicationConfig,
    options,
    redisInstance,
    queueManager,
    databaseInstance,
    routes: [],
    workerId: null,
  });

  return { server, redisSubscriberMock };
};

describe('WebSocketServer AbortController integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should tie inactivity interval to an abort controller managed by the lifecycle manager', async () => {
    const { server } = createServer({
      options: {
        disconnectInactiveClients: {
          enabled: true,
          intervalCheckTime: 1_000,
        },
      },
    });

    // Prevent the real check logic from running during tests
    (server as unknown as { checkInactiveClients: () => void }).checkInactiveClients = vi.fn();

    // Provide a minimal WS server to satisfy handleServerStart preconditions
    (server as unknown as { server: ReturnType<typeof createFakeWebSocketServer> }).server =
      createFakeWebSocketServer();

    let capturedSignal: AbortSignal | undefined;
    let abortTriggered = false;

    vi.spyOn(global, 'setInterval' as any).mockImplementation(
      (fn: () => void, ms: number, options?: { signal?: AbortSignal }) => {
        capturedSignal = options?.signal;
        options?.signal?.addEventListener('abort', () => {
          abortTriggered = true;
        });
        return {} as NodeJS.Timeout;
      },
    );

    (server as unknown as { handleServerStart(): void }).handleServerStart();

    const abortController = (server as unknown as { abortController: AbortController }).abortController;

    expect(capturedSignal).toBe(abortController.signal);
    expect(abortController.signal.aborted).toBe(false);

    const lifecycle = new LifecycleManager();
    lifecycle.trackAbortController(abortController);

    const result = await lifecycle.shutdown();

    expect(result.timedOut).toBe(false);
    expect(abortController.signal.aborted).toBe(true);
    expect(abortTriggered).toBe(true);
  });

  it('should abort the existing controller and create a fresh one on stop', async () => {
    const { server, redisSubscriberMock } = createServer();

    const originalController = (server as unknown as { abortController: AbortController }).abortController;
    expect(originalController.signal.aborted).toBe(false);

    await server.stop();

    expect(redisSubscriberMock.removeListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(redisSubscriberMock.unsubscribe).toHaveBeenCalled();
    expect(originalController.signal.aborted).toBe(true);

    const newController = (server as unknown as { abortController: AbortController }).abortController;
    expect(newController).not.toBe(originalController);
    expect(newController.signal.aborted).toBe(false);
  });
});
