import { WebSocketRedisSubscriberEvent, defineWebSocketSubscriber } from '../../../../../src/websocket/index.js';

/**
 * Whenever another worker publishes a custom message about system status,
 * relay it to any connected WebSocket clients.
 */
export default defineWebSocketSubscriber({
  name: 'systemStatusRelay',
  channel: WebSocketRedisSubscriberEvent.Custom,
  handle: async ({ message, webSocketServer }) => {
    if (message?.type !== 'system' || message?.action !== 'statusUpdate') {
      return;
    }

    webSocketServer.sendMessageToAll({
      data: {
        type: 'system',
        action: 'statusUpdate',
        data: {
          status: message?.data?.status ?? 'unknown',
          timestamp: new Date().toISOString(),
        },
      },
    });
  },
});
