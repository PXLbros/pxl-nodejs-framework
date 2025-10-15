import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketRedisSubscriberEvent } from '../../../../src/websocket/index.js';
import systemStatusRelay from '../../../../examples/hello-world/backend/websocket/subscribers/system-status.js';

describe('systemStatusRelay subscriber', () => {
  const sendMessageToAll = vi.fn();

  const createContext = (message: unknown) => ({
    channel: WebSocketRedisSubscriberEvent.Custom,
    message,
    webSocketServer: {
      sendMessageToAll,
    },
  });

  beforeEach(() => {
    sendMessageToAll.mockClear();
  });

  it('should relay system status updates to all WebSocket clients', async () => {
    const message = {
      type: 'system',
      action: 'statusUpdate',
      data: {
        status: 'Green',
      },
    };

    await systemStatusRelay.handle(createContext(message));

    expect(sendMessageToAll).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'system',
        action: 'statusUpdate',
        data: expect.objectContaining({
          status: 'Green',
        }),
      }),
    });
  });

  it('should ignore messages that are not system status updates', async () => {
    await systemStatusRelay.handle(
      createContext({
        type: 'system',
        action: 'other',
      }),
    );

    expect(sendMessageToAll).not.toHaveBeenCalled();
  });

  it('should ignore non-system messages', async () => {
    await systemStatusRelay.handle(
      createContext({
        type: 'other',
        action: 'statusUpdate',
      }),
    );

    expect(sendMessageToAll).not.toHaveBeenCalled();
  });
});
