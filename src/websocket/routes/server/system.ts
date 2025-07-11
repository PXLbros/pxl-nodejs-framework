import type { WebSocketRoute } from '../../websocket.interface.js';

export const webSocketSystemClientRoutes: WebSocketRoute[] = [
  {
    type: 'system',
    action: 'joinRoom',
    controllerName: 'system',
  },
  {
    type: 'system',
    action: 'leaveRoom',
    controllerName: 'system',
  },
];
