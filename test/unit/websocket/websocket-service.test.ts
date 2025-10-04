import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketService } from '../../../src/websocket/websocket-service.js';
import { WebSocketRedisSubscriberEvent } from '../../../src/websocket/websocket.interface.js';

describe('WebSocketService', () => {
  let message: { type: string; action: string; data?: any };

  beforeEach(() => {
    vi.clearAllMocks();
    message = { type: 'system', action: 'ping', data: { value: 1 } };
  });

  it('broadcasts directly via webSocketServer when available', async () => {
    const sendCustomMessage = vi.fn();
    const service = new WebSocketService({ webSocketServer: { sendCustomMessage } as any });

    await service.broadcast(message);

    expect(sendCustomMessage).toHaveBeenCalledWith({ data: message });
  });

  it('broadcasts via redis when server is not available', async () => {
    const publish = vi.fn().mockResolvedValue(1);
    const redisInstance = {
      publisherClient: {
        publish,
      },
    } as any;

    const service = new WebSocketService({ redisInstance, workerId: 'worker-1' });

    await service.broadcast(message);

    expect(publish).toHaveBeenCalledWith(
      WebSocketRedisSubscriberEvent.Custom,
      JSON.stringify({ ...message, workerId: 'worker-1' }),
    );
  });

  it('throws when broadcast is called without transport', async () => {
    const service = new WebSocketService();

    await expect(service.broadcast(message)).rejects.toThrow(
      'WebSocket service requires either webSocketServer or redisInstance',
    );
  });

  it('sendToClients delegates to broadcast', async () => {
    const service = new WebSocketService();
    const broadcastSpy = vi.spyOn(service, 'broadcast').mockResolvedValue();

    await service.sendToClients(['id-1'], message);

    expect(broadcastSpy).toHaveBeenCalledWith(message);
  });

  it('sendToRooms aggregates client ids and calls sendToClients', async () => {
    const rooms = new Map<string, Set<string>>([
      ['room-a', new Set(['client-1', 'client-2'])],
      ['room-b', new Set(['client-3'])],
    ]);
    const service = new WebSocketService({
      webSocketServer: {
        rooms,
        sendCustomMessage: vi.fn(),
      } as any,
    });
    const sendToClientsSpy = vi.spyOn(service, 'sendToClients').mockResolvedValue();

    await service.sendToRooms(['room-a', 'room-b'], message);

    expect(sendToClientsSpy).toHaveBeenCalledWith(['client-1', 'client-2', 'client-3'], message);
  });

  it('sendToRooms skips when no matching rooms exist', async () => {
    const rooms = new Map<string, Set<string>>();
    const service = new WebSocketService({
      webSocketServer: {
        rooms,
        sendCustomMessage: vi.fn(),
      } as any,
    });
    const sendToClientsSpy = vi.spyOn(service, 'sendToClients').mockResolvedValue();

    await service.sendToRooms(['missing'], message);

    expect(sendToClientsSpy).not.toHaveBeenCalled();
  });

  it('sendToRooms throws when server is not available', async () => {
    const service = new WebSocketService();

    await expect(service.sendToRooms(['room-a'], message)).rejects.toThrow(
      'Sending to specific rooms requires direct access to WebSocket server',
    );
  });

  it('provides convenience helpers for message types', async () => {
    const service = new WebSocketService();
    const broadcastSpy = vi.spyOn(service, 'broadcast').mockResolvedValue();

    await service.sendUserMessage('updated', { id: 1 });
    await service.sendSystemMessage('restarted', { uptime: 10 });
    await service.sendErrorMessage('failed', { message: 'Boom', code: 'E_FAIL' });

    expect(broadcastSpy).toHaveBeenNthCalledWith(1, { type: 'user', action: 'updated', data: { id: 1 } });
    expect(broadcastSpy).toHaveBeenNthCalledWith(2, { type: 'system', action: 'restarted', data: { uptime: 10 } });
    expect(broadcastSpy).toHaveBeenNthCalledWith(3, {
      type: 'error',
      action: 'failed',
      data: { message: 'Boom', code: 'E_FAIL', details: undefined },
    });
  });
});
