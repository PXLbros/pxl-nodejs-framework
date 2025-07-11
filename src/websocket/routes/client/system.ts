import type { WebSocketRoute } from '../../websocket.interface.js';

export const webSocketSystemClientRoutes: WebSocketRoute[] = [
  {
    type: 'system',
    action: 'clientList',
    controllerName: 'system',
  },
];
